import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderDetailsPage from '../src/pages/OrderDetailsPage';
import useAuth from '../src/hooks/useAuth';
import { getOrder } from '../src/services/orderService';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/orderService', () => ({
  getOrder: vi.fn(),
}));

const orderId = '507f1f77bcf86cd799439021';

const baseOrder = {
  id: orderId,
  orderDate: '2026-10-17T08:00:00.000Z',
  orderAmount: 29000,
  status: 'ORDER_CREATED',
  statusHistory: [],
  items: [
    {
      id: '507f1f77bcf86cd799439041',
      itemName: 'Classic Black Frame',
      quantity: 1,
      price: 29000,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
      <Routes>
        <Route path="/orders/:id" element={<OrderDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OrderDetailsPage payment revisit', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: {
        id: '507f1f77bcf86cd799439001',
        name: 'Sachini Uresha',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      },
      logout: vi.fn(),
    });

    getOrder.mockResolvedValue(baseOrder);
  });

  it('allows an ORDER_CREATED order to reopen the payment flow', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: `Order #${orderId}`,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Pay / Check Payment',
      }),
    ).toHaveAttribute('href', `/payments/${orderId}`);
  });

  it('does not offer another payment action after the order is processing', async () => {
    getOrder.mockResolvedValueOnce({
      ...baseOrder,
      status: 'PROCESSING',
    });

    renderPage();

    await screen.findByRole('heading', {
      name: `Order #${orderId}`,
    });

    expect(
      screen.queryByRole('link', {
        name: 'Pay / Check Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not offer payment for a cancelled order', async () => {
    getOrder.mockResolvedValueOnce({
      ...baseOrder,
      status: 'CANCELLED',
    });

    renderPage();

    await screen.findByRole('heading', {
      name: `Order #${orderId}`,
    });

    expect(
      screen.queryByRole('link', {
        name: 'Pay / Check Payment',
      }),
    ).not.toBeInTheDocument();
  });
});
