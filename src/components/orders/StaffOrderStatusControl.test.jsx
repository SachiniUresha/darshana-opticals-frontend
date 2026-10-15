import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import StaffOrderStatusControl from './StaffOrderStatusControl';
import { updateOrderStatus } from '../../services/orderService';
import { useState } from 'react';

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
      <Routes>
        <Route
          path="/"
          element={
            <StaffOrderStatusControl order={order} onUpdated={onUpdated} />
          }
        />
        <Route path="/login" element={<h1>Login Page</h1>} />
      </Routes>
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
  it('prevents duplicate status submissions while request is pending', async () => {
    let resolveUpdate;

    const pendingUpdate = new Promise((resolve) => {
      resolveUpdate = resolve;
    });

    updateOrderStatus.mockReturnValue(pendingUpdate);

    const onUpdated = show();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Next Order Status' }),
      { target: { value: 'PROCESSING' } },
    );

    // First submission
    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    // Button must be disabled while the request is pending
    const updatingButton = screen.getByRole('button', {
      name: 'Updating...',
    });

    expect(updatingButton.disabled).toBe(true);

    // Attempt a second submission
    fireEvent.click(updatingButton);

    // Only one API request should be made
    expect(updateOrderStatus).toHaveBeenCalledTimes(1);

    // Complete the pending backend request
    resolveUpdate({
      ...sampleOrder,
      status: 'PROCESSING',
    });

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    {
      status: 403,
      expectedMessage: 'You do not have permission to update this order.',
    },
    {
      status: 0,
      expectedMessage: 'Cannot connect to the server. Please try again.',
    },
    {
      status: 500,
      expectedMessage: 'Unable to update order status. Please try again.',
    },
  ])(
    'preserves the authoritative order state on status update error $status',
    async ({ status, expectedMessage }) => {
      updateOrderStatus.mockRejectedValue(
        Object.assign(new Error('Request failed'), { status }),
      );

      const onUpdated = show();

      fireEvent.change(
        screen.getByRole('combobox', { name: 'Next Order Status' }),
        { target: { value: 'PROCESSING' } },
      );

      fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        expectedMessage,
      );

      // Failed requests must not update the authoritative order.
      expect(onUpdated).not.toHaveBeenCalled();

      // The previous backend-confirmed status remains visible.
      expect(screen.getByText('ORDER CREATED')).toBeTruthy();

      // Never report a successful update after a failure.
      expect(
        screen.queryByText('Order status updated successfully.'),
      ).toBeNull();
    },
  );

  it('logs out and redirects to login on 401 status update failure', async () => {
    updateOrderStatus.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );

    const onUpdated = show();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Next Order Status' }),
      { target: { value: 'PROCESSING' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    expect(
      await screen.findByRole('heading', { name: 'Login Page' }),
    ).toBeTruthy();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();

    expect(screen.queryByText('Order status updated successfully.')).toBeNull();
  });

  it('allows BRANCH_MANAGER to perform an approved status transition', async () => {
    auth.user = { role: 'BRANCH_MANAGER' };

    const updatedOrder = {
      ...sampleOrder,
      status: 'PROCESSING',
    };

    updateOrderStatus.mockResolvedValue(updatedOrder);

    const onUpdated = show();

    // Branch Manager must see the approved next-status options.
    const select = screen.getByRole('combobox', {
      name: 'Next Order Status',
    });

    expect(select).toBeTruthy();

    const options = screen.getAllByRole('option').map((option) => option.value);

    expect(options).toContain('PROCESSING');
    expect(options).toContain('CANCELLED');
    expect(options).not.toContain('COMPLETED');

    // Select an approved transition.
    fireEvent.change(select, {
      target: { value: 'PROCESSING' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    // Backend must receive the canonical status value.
    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(
        sampleOrder.id,
        'PROCESSING',
      );
      expect(onUpdated).toHaveBeenCalledWith(updatedOrder);
    });

    expect(screen.getByText('Order status updated successfully.')).toBeTruthy();
  });

  it('focuses the error message when a status update fails', async () => {
    updateOrderStatus.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );

    show();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Next Order Status' }),
      { target: { value: 'PROCESSING' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    const errorMessage = await screen.findByRole('alert');

    expect(errorMessage).toHaveTextContent(
      'You do not have permission to update this order.',
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(errorMessage);
    });
  });

  it('focuses success feedback when a terminal update removes the form', async () => {
    const initialOrder = {
      ...sampleOrder,
      status: 'PICKED_UP',
    };

    const completedOrder = {
      ...initialOrder,
      status: 'COMPLETED',
    };

    updateOrderStatus.mockResolvedValue(completedOrder);

    function TestHarness() {
      const [order, setOrder] = useState(initialOrder);

      return <StaffOrderStatusControl order={order} onUpdated={setOrder} />;
    }

    render(
      <MemoryRouter>
        <TestHarness />
      </MemoryRouter>,
    );

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Next Order Status' }),
      { target: { value: 'COMPLETED' } },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update Status' }));

    const successMessage = await screen.findByRole('status');

    await waitFor(() => {
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(
        screen.getByText('No further status transitions are available.'),
      ).toBeInTheDocument();

      expect(document.activeElement).toBe(successMessage);
    });

    expect(updateOrderStatus).toHaveBeenCalledWith(
      initialOrder.id,
      'COMPLETED',
    );
  });
});
