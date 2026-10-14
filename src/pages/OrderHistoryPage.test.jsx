// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderHistoryPage from './OrderHistoryPage';
import { getOrders } from '../services/orderService';

vi.mock('../services/orderService', () => ({ getOrders: vi.fn() }));
const stableLogout = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useAuth', () => ({
  default: () => ({ logout: stableLogout }),
}));
vi.mock('../components/orders/OrderShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

function show() {
  return render(
    <MemoryRouter initialEntries={['/orders']}>
      <Routes>
        <Route path="/orders" element={<OrderHistoryPage />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderHistoryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading then customer orders from the API', async () => {
    let resolve;
    getOrders.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    show();
    expect(screen.getByText('Loading your orders...')).toBeTruthy();
    resolve([
      {
        id: 'OS-1024',
        status: 'PROCESSING',
        orderAmount: 18500,
        orderDate: '2026-10-08T10:30:00Z',
      },
    ]);
    expect(await screen.findByText('Order #OS-1024')).toBeTruthy();
    expect(screen.getByText('LKR 18,500.00')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /view details/i }).getAttribute('href'),
    ).toBe('/orders/OS-1024');
  });

  it('shows an empty state', async () => {
    getOrders.mockResolvedValue([]);
    show();
    expect(await screen.findByText(/No orders yet/i)).toBeTruthy();
  });

  it('explains a missing history endpoint and retries', async () => {
    getOrders
      .mockRejectedValueOnce(
        Object.assign(new Error('missing'), { status: 404, code: 'NOT_FOUND' }),
      )
      .mockResolvedValueOnce([]);
    show();
    expect(
      await screen.findByText(/Order history is currently unavailable/i),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText(/No orders yet/i)).toBeTruthy();
    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('shows a network error', async () => {
    getOrders.mockRejectedValue(
      Object.assign(new Error('offline'), { status: 0 }),
    );
    show();
    expect(
      await screen.findByText(/Cannot connect to the server/i),
    ).toBeTruthy();
  });

  it('shows a permission error', async () => {
    getOrders.mockRejectedValue(
      Object.assign(new Error('forbidden'), { status: 403 }),
    );
    show();
    expect(
      await screen.findByText(/permission to view your order history/i),
    ).toBeTruthy();
  });

  it('logs out and redirects to login when the API returns 401', async () => {
    getOrders.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );

    show();

    expect(
      await screen.findByRole('heading', { name: 'Login destination' }),
    ).toBeTruthy();

    expect(stableLogout).toHaveBeenCalledTimes(1);

    expect(screen.queryByText('Order #OS-1024')).toBeNull();
  });
});
