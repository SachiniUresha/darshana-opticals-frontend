import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from '../src/components/common/Navbar';
import useAuth from '../src/hooks/useAuth';
import useCart from '../src/hooks/useCart';
import {
  BRANCH_ASSISTANT,
  BRANCH_MANAGER,
  CUSTOMER,
  INVENTORY_MANAGER,
  MANAGEMENT,
  OPTOMETRIST,
  SALES_ASSISTANT_CASHIER,
  SYSTEM_ADMIN,
} from '../src/config/roles';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useCart');

function renderNavbar(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<Navbar />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
        <Route path="/profile" element={<h1>Profile destination</h1>} />
        <Route path="/cart" element={<h1>Cart destination</h1>} />

        <Route
          path="/products"
          element={
            <>
              <Navbar />
              <h1>Products destination</h1>
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Navbar authentication controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useCart.mockReturnValue({
      cartCount: 0,
    });
  });

  it('shows login and signup links when the user is unauthenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
    });

    renderNavbar();

    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: /profile/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /log out/i }),
    ).not.toBeInTheDocument();
  });

  it('shows profile and logout controls when authenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: CUSTOMER },
      logout: vi.fn(),
    });

    renderNavbar();

    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /log out/i }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: /log in/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', { name: /sign up/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the synchronized cart count for a customer', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: CUSTOMER },
      logout: vi.fn(),
    });

    useCart.mockReturnValue({
      cartCount: 3,
    });

    renderNavbar();

    expect(screen.getByRole('link', { name: /cart/i })).toHaveAttribute(
      'href',
      '/cart',
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it.each([
    SYSTEM_ADMIN,
    INVENTORY_MANAGER,
    BRANCH_MANAGER,
    OPTOMETRIST,
    MANAGEMENT,
    SALES_ASSISTANT_CASHIER,
  ])('hides Profile but keeps Logout for %s', (role) => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role },
      logout: vi.fn(),
    });

    renderNavbar();

    expect(
      screen.queryByRole('link', { name: /^profile$/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /log out/i }),
    ).toBeInTheDocument();
  });

  it('opens the customer profile route from the authenticated navbar', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: CUSTOMER },
      logout: vi.fn(),
    });

    const user = userEvent.setup();

    renderNavbar();

    await user.click(screen.getByRole('link', { name: /profile/i }));

    expect(
      await screen.findByRole('heading', {
        name: /profile destination/i,
      }),
    ).toBeInTheDocument();
  });

  it('logs the user out and redirects to the login page', async () => {
    const logout = vi.fn();

    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: CUSTOMER },
      logout,
    });

    const user = userEvent.setup();

    renderNavbar();

    await user.click(screen.getByRole('button', { name: /log out/i }));

    expect(logout).toHaveBeenCalledTimes(1);

    expect(
      await screen.findByRole('heading', {
        name: /login destination/i,
      }),
    ).toBeInTheDocument();
  });

  it('navigates to the product catalog when a search is submitted', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
    });

    const user = userEvent.setup();

    renderNavbar();

    const searchInput = screen.getByRole('searchbox', {
      name: /search frames/i,
    });

    await user.type(searchInput, 'pilot');
    await user.keyboard('{Enter}');

    expect(
      await screen.findByRole('heading', {
        name: /products destination/i,
      }),
    ).toBeInTheDocument();
  });

  it('clears an existing product search when an empty search is submitted', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
    });

    const user = userEvent.setup();

    renderNavbar('/products?q=pilot');

    const searchInput = screen.getByRole('searchbox', {
      name: /search frames/i,
    });

    expect(searchInput).toHaveValue('pilot');

    await user.clear(searchInput);
    await user.keyboard('{Enter}');

    expect(searchInput).toHaveValue('');

    expect(
      await screen.findByRole('heading', {
        name: /products destination/i,
      }),
    ).toBeInTheDocument();
  });

  it('preserves public home, category, and search navigation', () => {
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: vi.fn(),
    });

    renderNavbar();

    expect(
      screen.getByRole('link', { name: /darshana opticals home/i }),
    ).toHaveAttribute('href', '/');

    expect(
      screen.getByRole('searchbox', { name: /search frames/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Men' })).toHaveAttribute(
      'href',
      '/products?category=Men',
    );

    expect(screen.getByRole('link', { name: 'Women' })).toHaveAttribute(
      'href',
      '/products?category=Women',
    );

    expect(screen.getByRole('link', { name: 'Kids' })).toHaveAttribute(
      'href',
      '/products?category=Kids',
    );

    expect(screen.getByRole('link', { name: 'Sunglasses' })).toHaveAttribute(
      'href',
      '/products?category=Sunglasses',
    );
  });

  it('shows prescription recording link to OPTOMETRIST', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: OPTOMETRIST },
      logout: vi.fn(),
    });

    renderNavbar();

    expect(
      screen.getByRole('link', {
        name: 'Record Prescription',
      }),
    ).toHaveAttribute('href', '/clinical/prescriptions/new');
  });

  it.each([CUSTOMER, BRANCH_MANAGER])(
    'hides prescription recording link from %s',
    (role) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { role },
        logout: vi.fn(),
      });

      renderNavbar();

      expect(
        screen.queryByRole('link', {
          name: 'Record Prescription',
        }),
      ).not.toBeInTheDocument();
    },
  );

  it('shows the appointments link to authenticated customers', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        role: CUSTOMER,
      },
      logout: vi.fn(),
    });

    renderNavbar();

    expect(
      screen.getByRole('link', {
        name: 'Appointments',
      }),
    ).toHaveAttribute('href', '/appointments');
  });

  it('toggles the customer account menu accessibly', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role: CUSTOMER },
      logout: vi.fn(),
    });

    const { container } = renderNavbar();

    const menuButton = container.querySelector('.navbar__menu-button');
    const accountMenu = container.querySelector('#navbar-account-menu');

    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-label', 'Toggle account menu');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    expect(accountMenu).toBeInTheDocument();
    expect(accountMenu).not.toHaveClass('navbar__account-links--open');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(accountMenu).toHaveClass('navbar__account-links--open');

    expect(
      screen.getByRole('link', {
        name: 'Appointments',
      }),
    ).toHaveAttribute('href', '/appointments');

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(accountMenu).not.toHaveClass('navbar__account-links--open');
  });

  it.each([BRANCH_ASSISTANT, BRANCH_MANAGER])(
    'shows Staff Orders link to %s',
    (role) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { role },
        logout: vi.fn(),
      });

      renderNavbar();

      expect(
        screen.getByRole('link', { name: 'Staff Orders' }),
      ).toHaveAttribute('href', '/staff/orders');
    },
  );

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'hides Staff Orders link from %s',
    (role) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { role },
        logout: vi.fn(),
      });

      renderNavbar();

      expect(
        screen.queryByRole('link', { name: 'Staff Orders' }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    [BRANCH_MANAGER, 'Branch Manager'],
    [BRANCH_ASSISTANT, 'Branch Assistant'],
  ])('displays correct staff role label for %s', (role, label) => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { role },
      logout: vi.fn(),
    });

    renderNavbar();

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'hides staff role identification from %s',
    (role) => {
      useAuth.mockReturnValue({
        isAuthenticated: true,
        user: { role },
        logout: vi.fn(),
      });

      renderNavbar();

      expect(screen.queryByText('Branch Manager')).not.toBeInTheDocument();
      expect(screen.queryByText('Branch Assistant')).not.toBeInTheDocument();
    },
  );
});
