import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import AppRoutes from '../src/routes/AppRoutes';
import { BRANCH_MANAGER, CUSTOMER } from '../src/config/roles';

const mockAuth = vi.hoisted(() => ({
  current: {
    isAuthenticated: true,
    user: {
      role: 'CUSTOMER',
    },
  },
}));

vi.mock('../src/hooks/useAuth', () => ({
  default: () => mockAuth.current,
}));

vi.mock('../src/layouts/AppLayout', () => ({
  default: () => <Outlet />,
}));

vi.mock('../src/pages/CustomerLoyaltyPage', () => ({
  default: () => <h1>Customer Loyalty Page</h1>,
}));

vi.mock('../src/pages/HomePage', () => ({
  default: () => <h1>Home destination</h1>,
}));

vi.mock('../src/pages/LoginPage', () => ({
  default: () => <h1>Login destination</h1>,
}));

function CurrentLocation() {
  const location = useLocation();

  return <output data-testid="current-path">{location.pathname}</output>;
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/profile/loyalty']}>
      <AppRoutes />
      <CurrentLocation />
    </MemoryRouter>,
  );
}

describe('Customer loyalty route protection', () => {
  beforeEach(() => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: CUSTOMER,
      },
    };
  });

  it('allows an authenticated CUSTOMER to view own loyalty', () => {
    renderRoute();

    expect(
      screen.getByRole('heading', {
        name: 'Customer Loyalty Page',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/profile/loyalty',
    );
  });

  it('redirects an unauthenticated user to Login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    renderRoute();

    expect(
      screen.getByRole('heading', {
        name: 'Login destination',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });

  it('blocks BRANCH_MANAGER from the Customer loyalty route', () => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: BRANCH_MANAGER,
      },
    };

    renderRoute();

    expect(
      screen.getByRole('heading', {
        name: 'Home destination',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
  });
});
