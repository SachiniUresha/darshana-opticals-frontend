import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryReorderAlerts from '../src/components/InventoryReorderAlerts';
import { getActiveReorderAlerts } from '../src/services/inventoryService';

vi.mock('../src/services/inventoryService', () => ({
  getActiveReorderAlerts: vi.fn(),
}));

const row = {
  _id: 'alert-1',
  inventoryId: { _id: 'item-1', itemName: 'Blue Frame' },
  branchId: { _id: 'branch-1', address: 'Kandy Road' },
  currentQuantity: 2,
  threshold: 5,
  status: 'ACTIVE',
  updatedAt: '2026-10-16T09:00:00.000Z',
};
const result = (alerts, total = alerts.length, page = 1) => ({
  alerts,
  total,
  page,
  limit: 20,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('active reorder alert view', () => {
  it('renders backend-provided quantity, threshold, status, and branch information', async () => {
    getActiveReorderAlerts.mockResolvedValueOnce(result([row]));
    render(<InventoryReorderAlerts branchId="branch-1" refreshCount={0} />);
    expect(await screen.findByText('Blue Frame')).toBeInTheDocument();
    expect(screen.getByText('Kandy Road')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('1 active')).toBeInTheDocument();
    expect(getActiveReorderAlerts).toHaveBeenCalledWith('branch-1', 1);
  });

  it('shows an empty state when no active alerts are returned', async () => {
    getActiveReorderAlerts.mockResolvedValueOnce(result([]));
    render(<InventoryReorderAlerts branchId="branch-1" refreshCount={0} />);
    expect(
      await screen.findByText('No active reorder alerts for this branch.'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 active')).toBeInTheDocument();
  });

  it('refreshes after inventory changes and removes resolved alerts only after a backend response', async () => {
    getActiveReorderAlerts
      .mockResolvedValueOnce(result([row]))
      .mockResolvedValueOnce(result([]));
    const { rerender } = render(
      <InventoryReorderAlerts branchId="branch-1" refreshCount={0} />,
    );
    expect(await screen.findByText('Blue Frame')).toBeInTheDocument();
    rerender(<InventoryReorderAlerts branchId="branch-1" refreshCount={1} />);
    expect(
      await screen.findByText('No active reorder alerts for this branch.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Blue Frame')).not.toBeInTheDocument();
    expect(getActiveReorderAlerts).toHaveBeenCalledTimes(2);
  });

  it('renders new active alerts after the backend reports a re-trigger', async () => {
    getActiveReorderAlerts
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ ...row, _id: 'alert-2' }]));
    const { rerender } = render(
      <InventoryReorderAlerts branchId="branch-1" refreshCount={0} />,
    );
    expect(
      await screen.findByText('No active reorder alerts for this branch.'),
    ).toBeInTheDocument();
    rerender(<InventoryReorderAlerts branchId="branch-1" refreshCount={1} />);
    expect(await screen.findByText('Blue Frame')).toBeInTheDocument();
  });

  it('paginates through the API and does not infer the next page from local stock values', async () => {
    getActiveReorderAlerts
      .mockResolvedValueOnce(result([row], 21))
      .mockResolvedValueOnce(result([{ ...row, _id: 'alert-2' }], 21, 2));
    render(<InventoryReorderAlerts branchId="branch-1" refreshCount={0} />);
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(getActiveReorderAlerts).toHaveBeenLastCalledWith('branch-1', 2);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('provides retry on network failure without showing server details', async () => {
    getActiveReorderAlerts
      .mockRejectedValueOnce(new Error('private backend details'))
      .mockResolvedValueOnce(result([]));
    render(<InventoryReorderAlerts branchId="branch-1" refreshCount={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load reorder alerts',
    );
    expect(
      screen.queryByText('private backend details'),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try Again' }));
    expect(
      await screen.findByText('No active reorder alerts for this branch.'),
    ).toBeInTheDocument();
  });

  it('blocks retry and displays safe feedback for 403 responses', async () => {
    getActiveReorderAlerts.mockRejectedValueOnce(
      Object.assign(new Error('private backend details'), { status: 403 }),
    );
    render(<InventoryReorderAlerts branchId="branch-1" refreshCount={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(
      screen.queryByRole('button', { name: 'Try Again' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('private backend details'),
    ).not.toBeInTheDocument();
  });

  it('ignores a stale response when a different branch is selected', async () => {
    let finish;
    getActiveReorderAlerts
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValueOnce(
        result([
          {
            ...row,
            _id: 'alert-2',
            inventoryId: { itemName: 'New Branch Frame' },
          },
        ]),
      );
    const { rerender } = render(
      <InventoryReorderAlerts branchId="branch-1" refreshCount={0} />,
    );
    rerender(<InventoryReorderAlerts branchId="branch-2" refreshCount={0} />);
    expect(await screen.findByText('New Branch Frame')).toBeInTheDocument();
    await act(async () => finish(result([row])));
    expect(screen.queryByText('Blue Frame')).not.toBeInTheDocument();
  });

  it('returns to an existing page after the backend resolves previously active alerts', async () => {
    getActiveReorderAlerts
      .mockResolvedValueOnce(result([row], 21))
      .mockResolvedValueOnce(result([], 1, 2))
      .mockResolvedValueOnce(result([row], 1, 1));
    render(<InventoryReorderAlerts branchId="branch-1" refreshCount={0} />);
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(getActiveReorderAlerts).toHaveBeenCalledTimes(3),
    );
    expect(await screen.findByText('Blue Frame')).toBeInTheDocument();
    expect(screen.queryByText('Page 2 of 2')).not.toBeInTheDocument();
  });
});

describe('Reorder alert session expiry', () => {
  it('uses the supplied shared logout callback on backend 401', async () => {
    const onUnauthorized = vi.fn();
    getActiveReorderAlerts.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    render(
      <InventoryReorderAlerts
        branchId="branch-1"
        refreshCount={0}
        onUnauthorized={onUnauthorized}
      />,
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });
});
