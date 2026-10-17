import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import AppRoutes from '../src/routes/AppRoutes';
import {
  BRANCH_ASSISTANT,
  BRANCH_MANAGER,
  CUSTOMER,
  OPTOMETRIST,
  SYSTEM_ADMIN,
} from '../src/config/roles';

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

vi.mock('../src/pages/StaffLoyaltyPage', () => ({
  default: () => <h1>Staff Loyalty Page</h1>,
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

function renderRoute(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
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
    renderRoute('/profile/loyalty');

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

    renderRoute('/profile/loyalty');

    expect(
      screen.getByRole('heading', {
        name: 'Login destination',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });

  it.each([BRANCH_MANAGER, BRANCH_ASSISTANT, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from the Customer loyalty route',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: {
          role,
        },
      };

      renderRoute('/profile/loyalty');

      expect(
        screen.getByRole('heading', {
          name: 'Home destination',
        }),
      ).toBeInTheDocument();

      expect(screen.getByTestId('current-path')).toHaveTextContent('/');
    },
  );
});

describe('Loyalty monitoring route protection', () => {
  beforeEach(() => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: BRANCH_MANAGER,
      },
    };
  });

  it('allows BRANCH_MANAGER to access loyalty monitoring', () => {
    renderRoute('/staff/loyalty');

    expect(
      screen.getByRole('heading', {
        name: 'Staff Loyalty Page',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/staff/loyalty',
    );
  });

  it('redirects an unauthenticated user to Login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    renderRoute('/staff/loyalty');

    expect(
      screen.getByRole('heading', {
        name: 'Login destination',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });

  it.each([CUSTOMER, BRANCH_ASSISTANT, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from loyalty monitoring',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: {
          role,
        },
      };

      renderRoute('/staff/loyalty');

      expect(
        screen.getByRole('heading', {
          name: 'Home destination',
        }),
      ).toBeInTheDocument();

      expect(screen.getByTestId('current-path')).toHaveTextContent('/');
    },
  );
});
