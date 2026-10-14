import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddToCartButton from '../src/components/cart/AddToCartButton';
import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');

const product = {
  id: 'inventory-1',
  name: 'Austen Classic',
};

function renderButton() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<AddToCartButton product={product} />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AddToCartButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        role: 'CUSTOMER',
      },
    });

    useCart.mockReturnValue({
      addItem: vi.fn().mockResolvedValue(true),
      isLoading: false,
      isMutating: false,
    });
  });

  it('adds one item to the authenticated customer cart', async () => {
    const addItem = vi.fn().mockResolvedValue(true);

    useCart.mockReturnValue({
      addItem,
      isLoading: false,
      isMutating: false,
    });

    const user = userEvent.setup();

    renderButton();

    await user.click(
      screen.getByRole('button', {
        name: 'Add Austen Classic to cart',
      }),
    );

    expect(addItem).toHaveBeenCalledWith('inventory-1', 1);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Added to cart.',
    );
  });

  it('redirects an unauthenticated user to login instead of modifying the cart', async () => {
    const addItem = vi.fn();

    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    useCart.mockReturnValue({
      addItem,
      isLoading: false,
      isMutating: false,
    });

    const user = userEvent.setup();

    renderButton();

    await user.click(
      screen.getByRole('button', {
        name: 'Add Austen Classic to cart',
      }),
    );

    expect(addItem).not.toHaveBeenCalled();

    expect(
      await screen.findByRole('heading', {
        name: 'Login destination',
      }),
    ).toBeInTheDocument();
  });

  it('does not show the cart action for a non-customer authenticated user', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        role: 'OPTOMETRIST',
      },
    });

    renderButton();

    expect(
      screen.queryByRole('button', {
        name: 'Add Austen Classic to cart',
      }),
    ).not.toBeInTheDocument();
  });

  it('shows an error when adding the item fails', async () => {
    const addItem = vi.fn().mockResolvedValue(false);

    useCart.mockReturnValue({
      addItem,
      isLoading: false,
      isMutating: false,
    });

    const user = userEvent.setup();

    renderButton();

    await user.click(
      screen.getByRole('button', {
        name: 'Add Austen Classic to cart',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to add this item. Please try again.',
    );
  });

  it('disables the button while the cart is initially loading', () => {
    useCart.mockReturnValue({
      addItem: vi.fn(),
      isLoading: true,
      isMutating: false,
    });

    renderButton();

    expect(
      screen.getByRole('button', {
        name: 'Add Austen Classic to cart',
      }),
    ).toBeDisabled();

    expect(
      screen.getByRole('button', {
        name: 'Add Austen Classic to cart',
      }),
    ).toHaveTextContent('Adding...');
  });

  it('disables the button while another cart mutation is running', () => {
    useCart.mockReturnValue({
      addItem: vi.fn(),
      isLoading: false,
      isMutating: true,
    });

    renderButton();

    expect(
      screen.getByRole('button', {
        name: 'Add Austen Classic to cart',
      }),
    ).toBeDisabled();
  });
});
