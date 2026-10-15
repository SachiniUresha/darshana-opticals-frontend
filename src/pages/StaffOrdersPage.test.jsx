import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import StaffOrdersPage from './StaffOrdersPage';
import { getOrders } from '../services/orderService';

vi.mock('../services/orderService', () => ({
  getOrders: vi.fn(),
}));

const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useAuth', () => ({
  default: () => ({
    logout: logoutMock,
  }),
}));

function showPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/orders']}>
      <Routes>
        <Route path="/staff/orders" element={<StaffOrdersPage />} />
        <Route path="/login" element={<h1>Login Page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sampleOrder = {
  id: '507f1f77bcf86cd799439021',
  orderDate: '2026-10-08T10:30:00Z',
  orderAmount: 18500,
  status: 'PROCESSING',
};

describe('StaffOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays orders returned by the backend', async () => {
    getOrders.mockResolvedValue([sampleOrder]);

    showPage();

    expect(await screen.findByText(`Order #${sampleOrder.id}`)).toBeTruthy();

    expect(screen.getByText('PROCESSING')).toBeTruthy();
    expect(screen.getByText('LKR 18,500.00')).toBeTruthy();

    expect(
      screen.getByRole('link', { name: /view details/i }).getAttribute('href'),
    ).toBe(`/staff/orders/${sampleOrder.id}`);
  });

  it('shows an empty state when no orders exist', async () => {
    getOrders.mockResolvedValue([]);

    showPage();

    expect(await screen.findByText('No customer orders found.')).toBeTruthy();
  });

  it('displays access denied when backend returns 403', async () => {
    getOrders.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 }),
    );

    showPage();

    expect(
      await screen.findByText(
        'You do not have permission to view staff orders.',
      ),
    ).toBeTruthy();
  });

  it('logs out and redirects to login on 401', async () => {
    getOrders.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    );

    showPage();

    expect(
      await screen.findByRole('heading', { name: 'Login Page' }),
    ).toBeTruthy();

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes orders using backend data', async () => {
    getOrders
      .mockResolvedValueOnce([sampleOrder])
      .mockResolvedValueOnce([{ ...sampleOrder, status: 'READY_FOR_PICKUP' }]);

    showPage();

    expect(await screen.findByText('PROCESSING')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(screen.getByText('READY FOR PICKUP')).toBeTruthy();
    });

    expect(getOrders).toHaveBeenCalledTimes(2);
  });
});
