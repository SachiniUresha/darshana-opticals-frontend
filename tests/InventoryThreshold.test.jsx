import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryThreshold from '../src/components/InventoryThreshold';
import {
  getGlobalReorderThreshold,
  updateGlobalReorderThreshold,
} from '../src/services/inventoryService';

vi.mock('../src/services/inventoryService', () => ({
  getGlobalReorderThreshold: vi.fn(),
  updateGlobalReorderThreshold: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getGlobalReorderThreshold.mockResolvedValue(5);
});

describe('global reorder threshold management', () => {
  it('loads and displays only the authoritative threshold', async () => {
    render(<InventoryThreshold />);
    expect(
      await screen.findByText('5', { selector: 'strong' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', { name: 'New global threshold' }),
    ).toHaveValue(5);
    expect(getGlobalReorderThreshold).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Update Threshold' }),
    ).toBeDisabled();
  });

  it('waits for the backend confirmation, prevents repeated updates and refreshes inventory', async () => {
    let resolveUpdate;
    updateGlobalReorderThreshold.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    const onUpdated = vi.fn();
    render(<InventoryThreshold onUpdated={onUpdated} />);
    const user = userEvent.setup();
    const input = await screen.findByRole('spinbutton', {
      name: 'New global threshold',
    });
    await user.clear(input);
    await user.type(input, '3');
    await user.click(screen.getByRole('button', { name: 'Update Threshold' }));
    expect(
      await screen.findByRole('button', { name: 'Updating...' }),
    ).toBeDisabled();
    expect(input).toBeDisabled();
    expect(screen.getByText('5', { selector: 'strong' })).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(updateGlobalReorderThreshold).toHaveBeenCalledTimes(1);
    expect(updateGlobalReorderThreshold).toHaveBeenCalledWith(3);
    await act(async () => resolveUpdate(3));
    expect(
      await screen.findByText('Global reorder threshold updated.'),
    ).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'strong' })).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it.each(['', '-2', 'invalid'])(
    'rejects invalid input %s without sending a request',
    async (value) => {
      render(<InventoryThreshold />);
      const user = userEvent.setup();
      const input = await screen.findByRole('spinbutton', {
        name: 'New global threshold',
      });
      await user.clear(input);
      if (value === 'invalid') {
        // Number input blocks characters; the empty value still requires validation.
        await user.type(input, 'a');
      } else if (value) {
        await user.type(input, value);
      }
      await user.click(
        screen.getByRole('button', { name: 'Update Threshold' }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        'non-negative reorder threshold',
      );
      expect(updateGlobalReorderThreshold).not.toHaveBeenCalled();
    },
  );

  it('keeps the old threshold when the backend cannot reconcile stock alerts', async () => {
    updateGlobalReorderThreshold.mockRejectedValueOnce(
      Object.assign(new Error('MongoDB internal details'), {
        status: 500,
        code: 'THRESHOLD_UPDATE_UNAVAILABLE',
      }),
    );
    render(<InventoryThreshold />);
    const user = userEvent.setup();
    const input = await screen.findByRole('spinbutton', {
      name: 'New global threshold',
    });
    await user.clear(input);
    await user.type(input, '6');
    await user.click(screen.getByRole('button', { name: 'Update Threshold' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'currently unavailable',
    );
    expect(screen.getByText('5', { selector: 'strong' })).toBeInTheDocument();
    expect(
      screen.queryByText('MongoDB internal details'),
    ).not.toBeInTheDocument();
  });

  it('shows permission error without leaking backend details or retrying a mutation', async () => {
    updateGlobalReorderThreshold.mockRejectedValueOnce(
      Object.assign(new Error('secret details'), { status: 403 }),
    );
    render(<InventoryThreshold />);
    const user = userEvent.setup();
    const input = await screen.findByRole('spinbutton', {
      name: 'New global threshold',
    });
    await user.clear(input);
    await user.type(input, '7');
    await user.click(screen.getByRole('button', { name: 'Update Threshold' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(screen.getByText('5', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByText('secret details')).not.toBeInTheDocument();
  });

  it('retries an initial failed read safely', async () => {
    getGlobalReorderThreshold
      .mockRejectedValueOnce(new Error('Internal details'))
      .mockResolvedValueOnce(4);
    render(<InventoryThreshold />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load reorder threshold',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() =>
      expect(
        screen.getByRole('spinbutton', { name: 'New global threshold' }),
      ).toHaveValue(4),
    );
    expect(getGlobalReorderThreshold).toHaveBeenCalledTimes(2);
  });
});
