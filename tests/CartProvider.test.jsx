import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER, SYSTEM_ADMIN } from '../src/config/roles';
import CartProvider from '../src/context/CartProvider';
import useCart from '../src/hooks/useCart';
import useAuth from '../src/hooks/useAuth';
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from '../src/services/cartService';
import { getProductById } from '../src/services/productService';

vi.mock('../src/hooks/useAuth');

vi.mock('../src/services/cartService', () => ({
  getCart: vi.fn(),
  addCartItem: vi.fn(),
  updateCartItemQuantity: vi.fn(),
  removeCartItem: vi.fn(),
}));

vi.mock('../src/services/productService', () => ({
  getProductById: vi.fn(),
}));

function CartProbe() {
  const {
    items,
    cartCount,
    cartTotal,
    hasUnavailableItems,
    error,
    addItem,
    updateItemQuantity,
    removeItem,
    refreshCart,
  } = useCart();

  return (
    <div>
      <p data-testid="cart-count">{cartCount}</p>

      <p data-testid="cart-total">{cartTotal}</p>

      <p data-testid="product-name">
        {items[0]?.product?.name || 'No product details'}
      </p>

      <p data-testid="unavailable-items">
        {hasUnavailableItems ? 'yes' : 'no'}
      </p>

      {error ? <p role="alert">{error}</p> : null}

      <button type="button" onClick={() => addItem('inventory-1')}>
        Add item
      </button>

      <button
        type="button"
        onClick={() => updateItemQuantity('inventory-1', 0)}
      >
        Set invalid quantity
      </button>

      <button type="button" onClick={() => removeItem('inventory-1')}>
        Remove item
      </button>

      <button type="button" onClick={refreshCart}>
        Retry cart
      </button>
    </div>
  );
}

function renderCartProvider() {
  return render(
    <CartProvider>
      <CartProbe />
    </CartProvider>,
  );
}

describe('CartProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'customer-1',
        role: CUSTOMER,
      },
    });

    getCart.mockResolvedValue({
      items: [],
    });
  });

  it('loads and hydrates the authenticated customer cart', async () => {
    getCart.mockResolvedValueOnce({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 2,
        },
      ],
    });

    getProductById.mockResolvedValueOnce({
      id: 'inventory-1',
      name: 'Austen Classic',
      brand: 'Oliver Peoples',
      price: 12500,
    });

    renderCartProvider();

    expect(await screen.findByText('Austen Classic')).toBeInTheDocument();

    expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('25000');
    expect(screen.getByTestId('unavailable-items')).toHaveTextContent('no');

    expect(getCart).toHaveBeenCalledTimes(1);
    expect(getProductById).toHaveBeenCalledWith('inventory-1');
  });

  it('does not load a customer cart for a non-customer role', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        id: 'admin-1',
        role: SYSTEM_ADMIN,
      },
    });

    renderCartProvider();

    await waitFor(() => {
      expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
    });

    expect(getCart).not.toHaveBeenCalled();
  });

  it('adds an item and synchronizes with backend-confirmed cart data', async () => {
    const user = userEvent.setup();

    addCartItem.mockResolvedValueOnce({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 1,
        },
      ],
    });

    getProductById.mockResolvedValueOnce({
      id: 'inventory-1',
      name: 'Austen Classic',
      brand: 'Oliver Peoples',
      price: 12500,
    });

    renderCartProvider();

    await waitFor(() => {
      expect(getCart).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole('button', {
        name: /add item/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
    });

    expect(addCartItem).toHaveBeenCalledWith('inventory-1', 1);
  });

  it('rejects an invalid quantity before calling the backend', async () => {
    const user = userEvent.setup();

    renderCartProvider();

    await user.click(
      screen.getByRole('button', {
        name: /set invalid quantity/i,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Quantity must be a positive whole number.',
    );

    expect(updateCartItemQuantity).not.toHaveBeenCalled();
  });

  it('keeps existing cart state when a mutation fails', async () => {
    const user = userEvent.setup();

    getCart.mockResolvedValueOnce({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 2,
        },
      ],
    });

    getProductById.mockResolvedValueOnce({
      id: 'inventory-1',
      name: 'Austen Classic',
      brand: 'Oliver Peoples',
      price: 12500,
    });

    removeCartItem.mockRejectedValueOnce(new Error('Server unavailable.'));

    renderCartProvider();

    await waitFor(() => {
      expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
    });

    await user.click(
      screen.getByRole('button', {
        name: /remove item/i,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't update your cart. Please try again.",
    );

    expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
  });

  it('preserves a cart item when its product details cannot be loaded', async () => {
    getCart.mockResolvedValueOnce({
      items: [
        {
          inventoryId: 'inventory-1',
          quantity: 3,
        },
      ],
    });

    getProductById.mockRejectedValueOnce(new Error('Unable to load product.'));

    renderCartProvider();

    await waitFor(() => {
      expect(screen.getByTestId('cart-count')).toHaveTextContent('3');
    });

    expect(screen.getByTestId('product-name')).toHaveTextContent(
      'No product details',
    );

    expect(screen.getByTestId('unavailable-items')).toHaveTextContent('yes');
  });

  it('retries loading the cart after an initial load failure', async () => {
    const user = userEvent.setup();

    getCart
      .mockRejectedValueOnce(new Error('Server unavailable.'))
      .mockResolvedValueOnce({
        items: [
          {
            inventoryId: 'inventory-1',
            quantity: 2,
          },
        ],
      });

    getProductById.mockResolvedValueOnce({
      id: 'inventory-1',
      name: 'Austen Classic',
      brand: 'Oliver Peoples',
      price: 12500,
    });

    renderCartProvider();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load your cart. Please try again.",
    );

    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');

    await user.click(
      screen.getByRole('button', {
        name: /retry cart/i,
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('product-name')).toHaveTextContent(
      'Austen Classic',
    );

    expect(screen.getByTestId('cart-total')).toHaveTextContent('25000');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    expect(getCart).toHaveBeenCalledTimes(2);
    expect(getProductById).toHaveBeenCalledWith('inventory-1');
  });
});
