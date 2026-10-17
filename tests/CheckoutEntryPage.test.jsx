import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutEntryPage from '../src/pages/CheckoutEntryPage';
import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';
import { submitCheckout } from '../src/services/checkoutService';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/hooks/useCart', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/checkoutService', () => ({
  submitCheckout: vi.fn(),
}));

const cartItems = [
  {
    inventoryId: '507f1f77bcf86cd799439011',
    quantity: 2,
    product: {
      id: '507f1f77bcf86cd799439011',
      name: 'Classic Black Frame',
      brand: 'Darshana',
      price: 12500,
    },
  },
  {
    inventoryId: '507f1f77bcf86cd799439012',
    quantity: 1,
    product: {
      id: '507f1f77bcf86cd799439012',
      name: 'Blue Light Lens',
      brand: 'Darshana',
      price: 5000,
    },
  },
];

const successfulCheckout = {
  order: {
    id: '507f1f77bcf86cd799439021',
    customerId: '507f1f77bcf86cd799439001',
    orderDate: '2026-10-14T02:30:00.000Z',
    orderAmount: 29000,
    status: 'ORDER_CREATED',
    statusUpdatedAt: '2026-10-14T02:30:00.000Z',
    statusHistory: [],
  },
  items: [
    {
      id: '507f1f77bcf86cd799439031',
      itemName: 'Classic Black Frame',
      price: 12000,
      quantity: 2,
    },
    {
      id: '507f1f77bcf86cd799439032',
      itemName: 'Blue Light Lens',
      price: 5000,
      quantity: 1,
    },
  ],
};

const refreshCart = vi.fn();
const logout = vi.fn();

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function mockCart(overrides = {}) {
  useCart.mockReturnValue({
    items: cartItems,
    cartTotal: 30000,
    hasUnavailableItems: false,
    isLoading: false,
    error: '',
    refreshCart,
    ...overrides,
  });
}

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes>
        <Route path="/checkout" element={<CheckoutEntryPage />} />
        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CheckoutEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    refreshCart.mockResolvedValue(true);

    useAuth.mockReturnValue({
      user: {
        id: '507f1f77bcf86cd799439001',
        role: 'CUSTOMER',
      },
      logout,
    });

    mockCart();
  });

  it('renders the current cart as a checkout review', () => {
    renderCheckout();

    expect(
      screen.getByRole('heading', {
        name: 'Review Your Order',
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Classic Black Frame').length).toBeGreaterThan(
      0,
    );

    expect(screen.getAllByText('Blue Light Lens').length).toBeGreaterThan(0);

    expect(screen.getByText('Rs.30,000')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /place order/i,
      }),
    ).toBeEnabled();
  });

  it('protects checkout when the cart is empty', () => {
    mockCart({
      items: [],
      cartTotal: 0,
    });

    renderCheckout();

    expect(
      screen.getByRole('heading', {
        name: 'Your cart is empty',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: /place order/i,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Browse Products',
      }),
    ).toHaveAttribute('href', '/products');
  });

  it('shows a cart load error with retry instead of an empty-cart message', async () => {
    const user = userEvent.setup();

    mockCart({
      items: [],
      cartTotal: 0,
      error: "We couldn't load your cart. Please try again.",
    });

    renderCheckout();

    expect(
      screen.getByRole('heading', {
        name: "We couldn't load your cart",
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your cart. Please try again.",
    );

    expect(
      screen.queryByRole('heading', {
        name: 'Your cart is empty',
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Retry',
      }),
    );

    expect(refreshCart).toHaveBeenCalledTimes(1);
  });

  it('prevents checkout when product information is unavailable', () => {
    mockCart({
      hasUnavailableItems: true,
    });

    renderCheckout();

    expect(
      screen.getByRole('button', {
        name: /place order/i,
      }),
    ).toBeDisabled();

    expect(
      screen.getByText(/some product information is currently unavailable/i),
    ).toBeInTheDocument();
  });

  it('prevents repeated submission while checkout is pending', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred();

    submitCheckout.mockReturnValueOnce(deferred.promise);

    renderCheckout();

    const placeOrderButton = screen.getByRole('button', {
      name: /place order/i,
    });

    await user.click(placeOrderButton);

    expect(submitCheckout).toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole('button', {
        name: /placing order/i,
      }),
    ).toBeDisabled();

    deferred.resolve(successfulCheckout);

    expect(
      await screen.findByRole('heading', {
        name: 'Order Created',
      }),
    ).toBeInTheDocument();
  });

  it('shows authoritative backend values after successful checkout', async () => {
    const user = userEvent.setup();

    submitCheckout.mockResolvedValueOnce(successfulCheckout);

    renderCheckout();

    await user.click(
      screen.getByRole('button', {
        name: /place order/i,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Order Created',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('507f1f77bcf86cd799439021')).toBeInTheDocument();

    expect(screen.getByText('ORDER CREATED')).toBeInTheDocument();

    /*
     * The cart displayed Rs.30,000 before checkout, while the backend
     * authoritative total is Rs.29,000.
     */
    expect(screen.getByText('Rs.29,000')).toBeInTheDocument();

    expect(refreshCart).toHaveBeenCalledTimes(1);
  });

  it('preserves the cart and shows a safe message when stock is insufficient', async () => {
    const user = userEvent.setup();

    submitCheckout.mockRejectedValueOnce(
      Object.assign(new Error('Insufficient Inventory stock.'), {
        status: 409,
        code: 'INSUFFICIENT_STOCK',
      }),
    );

    renderCheckout();

    await user.click(
      screen.getByRole('button', {
        name: /place order/i,
      }),
    );

    expect(
      await screen.findByText(/some items no longer have enough stock/i),
    ).toBeInTheDocument();

    expect(refreshCart).not.toHaveBeenCalled();

    expect(screen.getAllByText('Classic Black Frame').length).toBeGreaterThan(
      0,
    );

    expect(
      screen.getByRole('button', {
        name: /place order/i,
      }),
    ).toBeEnabled();
  });

  it('preserves the cart on a general checkout failure', async () => {
    const user = userEvent.setup();

    submitCheckout.mockRejectedValueOnce(
      Object.assign(new Error('Server error'), {
        status: 500,
      }),
    );

    renderCheckout();

    await user.click(
      screen.getByRole('button', {
        name: /place order/i,
      }),
    );

    expect(
      await screen.findByText(/your cart has been preserved/i),
    ).toBeInTheDocument();

    expect(refreshCart).not.toHaveBeenCalled();
  });

  it('follows the existing session pattern after an authentication failure', async () => {
    const user = userEvent.setup();

    submitCheckout.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
      }),
    );

    renderCheckout();

    await user.click(
      screen.getByRole('button', {
        name: /place order/i,
      }),
    );

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Login destination')).toBeInTheDocument();

    expect(refreshCart).not.toHaveBeenCalled();
  });
});
