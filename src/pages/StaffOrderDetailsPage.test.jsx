import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import StaffOrderDetailsPage from './StaffOrderDetailsPage';
import { getOrder } from '../services/orderService';

vi.mock('../services/orderService', () => ({
  getOrder: vi.fn(),
}));

const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useAuth', () => ({
  default: () => ({
    logout: logoutMock,
  }),
}));

// Status control has its own separate tests.
// Here we verify integration with the details page.
vi.mock('../components/orders/StaffOrderStatusControl', () => ({
  default: ({ order, onUpdated }) => (
    <button
      type="button"
      onClick={() =>
        onUpdated({
          ...order,
          status: 'READY_FOR_PICKUP',
          statusHistory: [
            ...(order.statusHistory || []),
            {
              status: 'READY_FOR_PICKUP',
              changedAt: '2026-10-14T08:00:00Z',
            },
          ],
        })
      }
    >
      Simulate confirmed update
    </button>
  ),
}));

const sampleOrder = {
  id: '507f1f77bcf86cd799439021',
  status: 'PROCESSING',
  orderDate: '2026-10-08T10:30:00Z',
  orderAmount: 18500,
  statusHistory: [
    {
      status: 'PROCESSING',
      changedAt: '2026-10-09T10:30:00Z',
    },
  ],
  items: [
    {
      id: '507f1f77bcf86cd799439031',
      itemName: 'Classic Black Frame',
      quantity: 1,
      price: 18500,
    },
  ],
};

function showPage() {
  return render(
    <MemoryRouter initialEntries={[`/staff/orders/${sampleOrder.id}`]}>
      <Routes>
        <Route path="/staff/orders/:id" element={<StaffOrderDetailsPage />} />
        <Route path="/login" element={<h1>Login Page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StaffOrderDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays order details from the backend', async () => {
    getOrder.mockResolvedValue(sampleOrder);

    showPage();

    expect(
      await screen.findByRole('heading', {
        name: `Order #${sampleOrder.id}`,
      }),
    ).toBeTruthy();

    expect(screen.getByText('Classic Black Frame')).toBeTruthy();
    expect(screen.getAllByText('PROCESSING').length).toBeGreaterThan(0);
    expect(screen.getAllByText('LKR 18,500.00')).toHaveLength(2);

    expect(getOrder).toHaveBeenCalledWith(sampleOrder.id);
  });

  it('displays authoritative tracking history', async () => {
    getOrder.mockResolvedValue(sampleOrder);

    showPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Order Tracking History',
      }),
    ).toBeTruthy();

    expect(
      screen.getByText('Confirmed tracking information from the backend'),
    ).toBeTruthy();
  });

  it('shows access denied on 403', async () => {
    getOrder.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );

    showPage();

    expect(
      await screen.findByText('You do not have permission to view this order.'),
    ).toBeTruthy();

    expect(screen.queryByText('Classic Black Frame')).toBeNull();
  });

  it('redirects to login when session expires', async () => {
    getOrder.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );

    showPage();

    expect(
      await screen.findByRole('heading', { name: 'Login Page' }),
    ).toBeTruthy();

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('retries after a network error', async () => {
    getOrder
      .mockRejectedValueOnce(Object.assign(new Error('Offline'), { status: 0 }))
      .mockResolvedValueOnce(sampleOrder);

    showPage();

    expect(
      await screen.findByText(/Cannot connect to the server/i),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(
      await screen.findByRole('heading', {
        name: `Order #${sampleOrder.id}`,
      }),
    ).toBeTruthy();

    expect(getOrder).toHaveBeenCalledTimes(2);
  });

  it('renders a backend-confirmed status update', async () => {
    getOrder.mockResolvedValue(sampleOrder);

    showPage();

    expect(
      await screen.findByText('PROCESSING', {
        selector: '.orders-card-header .orders-status',
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Simulate confirmed update',
      }),
    );

    expect(
      screen.getByText('READY FOR PICKUP', {
        selector: '.orders-card-header .orders-status',
      }),
    ).toBeTruthy();
  });
});
