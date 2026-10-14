import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CartPage from '../src/pages/CartPage';
import useCart from '../src/hooks/useCart';

vi.mock('../src/hooks/useCart');

const product = {
  id: 'austen-classic',
  name: 'Austen Classic',
  brand: 'Oliver Peoples',
  category: 'Men',
  price: 12500,
};

function mockCart(overrides = {}) {
  useCart.mockReturnValue({
    items: [],
    cartTotal: 0,
    hasUnavailableItems: false,
    isLoading: false,
    isMutating: false,
    error: '',
    updateItemQuantity: vi.fn().mockResolvedValue(true),
    removeItem: vi.fn().mockResolvedValue(true),
    refreshCart: vi.fn().mockResolvedValue(true),
    clearError: vi.fn(),
    ...overrides,
  });
}

function renderCart() {
  return render(
    <MemoryRouter>
      <CartPage />
    </MemoryRouter>,
  );
}

describe('CartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCart();
  });

  it('shows a loading state while the cart is loading', () => {
    mockCart({
      isLoading: true,
    });

    renderCart();

    expect(screen.getByText('Loading your cart...')).toBeInTheDocument();
  });

  it('shows the empty cart state with a link to browse products', () => {
    renderCart();

    expect(
      screen.getByRole('heading', {
        name: 'Your cart is empty',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Browse Products',
      }),
    ).toHaveAttribute('href', '/products');
  });

  it('renders cart items and provisional totals', () => {
    mockCart({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 2,
          product,
        },
      ],
      cartTotal: 25000,
    });

    renderCart();

    expect(
      screen.getByRole('heading', {
        name: 'Austen Classic',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Rs.12,500 each')).toBeInTheDocument();

    expect(screen.getAllByText('Rs.25,000')).toHaveLength(2);

    expect(
      screen.getByText(/final prices and stock availability/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Proceed to Checkout',
      }),
    ).toHaveAttribute('href', '/checkout');
  });

  it('increases the item quantity using the current backend-confirmed quantity', async () => {
    const updateItemQuantity = vi.fn().mockResolvedValue(true);
    const clearError = vi.fn();

    mockCart({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 2,
          product,
        },
      ],
      cartTotal: 25000,
      updateItemQuantity,
      clearError,
    });

    const user = userEvent.setup();

    renderCart();

    await user.click(
      screen.getByRole('button', {
        name: 'Increase quantity for Austen Classic',
      }),
    );

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(updateItemQuantity).toHaveBeenCalledWith('inventory-1', 3);
  });

  it('does not allow quantity to be decreased below one', () => {
    mockCart({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 1,
          product,
        },
      ],
      cartTotal: 12500,
    });

    renderCart();

    expect(
      screen.getByRole('button', {
        name: 'Decrease quantity for Austen Classic',
      }),
    ).toBeDisabled();
  });

  it('removes an item from the cart', async () => {
    const removeItem = vi.fn().mockResolvedValue(true);
    const clearError = vi.fn();

    mockCart({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 1,
          product,
        },
      ],
      cartTotal: 12500,
      removeItem,
      clearError,
    });

    const user = userEvent.setup();

    renderCart();

    await user.click(
      screen.getByRole('button', {
        name: 'Remove Austen Classic from cart',
      }),
    );

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith('inventory-1');
  });

  it('prevents checkout when product details are unavailable', () => {
    mockCart({
      items: [
        {
          inventoryId: 'inventory-missing',
          quantity: 1,
          product: null,
        },
      ],
      cartTotal: 0,
      hasUnavailableItems: true,
    });

    renderCart();

    expect(
      screen.getByText(/some product details are currently unavailable/i),
    ).toBeInTheDocument();

    const checkoutLink = screen.getByRole('link', {
      name: 'Proceed to Checkout',
    });

    expect(checkoutLink).toHaveAttribute('aria-disabled', 'true');
    expect(checkoutLink).toHaveAttribute('href', '/cart');
  });

  it('shows a cart error to the user', () => {
    mockCart({
      error: "We couldn't load your cart. Please try again.",
    });

    renderCart();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your cart. Please try again.",
    );
  });

  it('allows the customer to retry when loading the cart fails', async () => {
    const refreshCart = vi.fn().mockResolvedValue(true);

    mockCart({
      error: "We couldn't load your cart. Please try again.",
      refreshCart,
    });

    const user = userEvent.setup();

    renderCart();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your cart. Please try again.",
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Retry',
      }),
    );

    expect(refreshCart).toHaveBeenCalledTimes(1);
  });
});
