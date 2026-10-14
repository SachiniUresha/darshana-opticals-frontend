import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import StaffOrderStatusControl from './StaffOrderStatusControl';
import { updateOrderStatus } from '../../services/orderService';

vi.mock('../../services/orderService', () => ({
  updateOrderStatus: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: { role: 'BRANCH_ASSISTANT' },
  logout: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  default: () => auth,
}));

const sampleOrder = {
  id: '507f1f77bcf86cd799439021',
  status: 'ORDER_CREATED',
};

function show(order = sampleOrder, onUpdated = vi.fn()) {
  render(
    <MemoryRouter>
      <StaffOrderStatusControl order={order} onUpdated={onUpdated} />
    </MemoryRouter>,
  );

  return onUpdated;
}

describe('StaffOrderStatusControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { role: 'BRANCH_ASSISTANT' };
  });

  it('shows only allowed next statuses', () => {
    show();

    const options = screen.getAllByRole('option').map((option) => option.value);

    expect(options).toContain('PROCESSING');
    expect(options).toContain('CANCELLED');
    expect(options).not.toContain('COMPLETED');
  });

  it('does not show mutation controls for terminal orders', () => {
    show({ ...sampleOrder, status: 'COMPLETED' });

    expect(
      screen.getByText('No further status transitions are available.'),
    ).toBeTruthy();

    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('updates UI only after backend confirmation', async () => {
    const updatedOrder = {
      ...sampleOrder,
      status: 'PROCESSING',
    };

    updateOrderStatus.mockResolvedValue(updatedOrder);

    const onUpdated = show();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Next Order Status' }),
      { target: { value: 'PROCESSING' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updatedOrder);
    });

    expect(updateOrderStatus).toHaveBeenCalledWith(
      sampleOrder.id,
      'PROCESSING',
    );

    expect(screen.getByText('Order status updated successfully.')).toBeTruthy();
  });

  it('preserves existing order state when backend rejects transition', async () => {
    updateOrderStatus.mockRejectedValue(
      Object.assign(new Error('Invalid transition'), {
        status: 422,
      }),
    );

    const onUpdated = show();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Next Order Status' }),
      { target: { value: 'PROCESSING' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    expect(
      await screen.findByText(
        'Status update was not accepted. Refresh tracking and try again.',
      ),
    ).toBeTruthy();

    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('hides status controls from unauthorized roles', () => {
    auth.user = { role: 'OPTOMETRIST' };

    show();

    expect(screen.queryByText('Update Order Status')).toBeNull();

    expect(updateOrderStatus).not.toHaveBeenCalled();
  });
});
