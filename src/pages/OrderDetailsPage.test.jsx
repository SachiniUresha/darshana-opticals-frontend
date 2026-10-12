// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderDetailsPage from './OrderDetailsPage';
import { getOrder } from '../services/orderService';

vi.mock('../services/orderService', () => ({ getOrder: vi.fn() }));
const stableLogout = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useAuth', () => ({
  default: () => ({ logout: stableLogout }),
}));
vi.mock('../components/orders/OrderShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

function show() {
  return render(
    <MemoryRouter initialEntries={['/orders/OS-1024']}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetailsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows confirmed status history, items and persisted total', async () => {
    getOrder.mockResolvedValue({
      id: 'OS-1024',
      status: 'PROCESSING',
      orderAmount: 18500,
      orderDate: '2026-10-08T10:30:00Z',
      statusHistory: [
        {
          status: 'PROCESSING',
          changedAt: '2026-10-09T10:30:00Z',
        },
      ],
      items: [
        {
          id: 1,
          itemName: 'Classic Black Frame',
          quantity: 1,
          price: 12500,
        },
      ],
    });
    show();
    expect(
      await screen.findByRole('heading', { name: 'Order #OS-1024' }),
    ).toBeTruthy();
    expect(screen.getByText('Classic Black Frame')).toBeTruthy();
    expect(screen.getByText('LKR 18,500.00')).toBeTruthy();
    expect(screen.getAllByText('PROCESSING').length).toBeGreaterThan(0);
    expect(getOrder).toHaveBeenCalledWith('OS-1024');
  });

  it('does not fabricate tracking history when absent', async () => {
    getOrder.mockResolvedValue({
      id: 'OS-1024',
      status: 'PROCESSING',
      orderAmount: 10,
    });
    show();
    expect(
      await screen.findByText(/Detailed tracking history is not available/i),
    ).toBeTruthy();
  });

  it('handles an inaccessible order', async () => {
    getOrder.mockRejectedValue(
      Object.assign(new Error('not found'), { status: 404 }),
    );
    show();
    expect(await screen.findByText(/This order is unavailable/i)).toBeTruthy();
  });

  it('retries after an error', async () => {
    getOrder
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { status: 0 }))
      .mockResolvedValueOnce({ id: 'OS-1024', status: 'PROCESSING' });
    show();
    expect(
      await screen.findByText(/Cannot connect to the server/i),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(
      await screen.findByRole('heading', { name: 'Order #OS-1024' }),
    ).toBeTruthy();
    expect(getOrder).toHaveBeenCalledTimes(2);
  });
});
