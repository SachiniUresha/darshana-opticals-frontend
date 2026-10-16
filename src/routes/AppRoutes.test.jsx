import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import {
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
  CUSTOMER,
  OPTOMETRIST,
  SYSTEM_ADMIN,
} from '../config/roles';

const mockAuth = vi.hoisted(() => ({
  current: {
    isAuthenticated: true,
    user: { role: 'CUSTOMER' },
  },
}));

vi.mock('../hooks/useAuth', () => ({
  default: () => mockAuth.current,
}));

vi.mock('../layouts/AppLayout', () => ({
  default: () => <Outlet />,
}));

vi.mock('../pages/OrderHistoryPage', () => ({
  default: () => <div>Customer order history page</div>,
}));

vi.mock('../pages/OrderDetailsPage', () => ({
  default: () => <div>Customer order details page</div>,
}));

vi.mock('../pages/LoginPage', () => ({
  default: () => <div>Login page</div>,
}));

vi.mock('../pages/AdminStaffCreatePage', () => ({
  default: () => <h1>Add New Staff Member</h1>,
}));

vi.mock('../pages/StaffOrdersPage', () => ({
  default: () => <div>Staff orders page</div>,
}));

vi.mock('../pages/StaffOrderDetailsPage', () => ({
  default: () => <div>Staff order details page</div>,
}));

vi.mock('../pages/HomePage', () => ({
  default: () => <div>Home page</div>,
}));

function CurrentLocation() {
  const location = useLocation();

  return <output data-testid="current-path">{location.pathname}</output>;
}

function show(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <CurrentLocation />
    </MemoryRouter>,
  );
}

describe('Customer order route protection', () => {
  beforeEach(() => {
    mockAuth.current = {
      isAuthenticated: true,
      user: { role: CUSTOMER },
    };
  });

  it.each([
    ['/orders', 'Customer order history page'],
    ['/orders/507f1f77bcf86cd799439021', 'Customer order details page'],
  ])('allows CUSTOMER access to %s', (path, expectedPage) => {
    show(path);

    expect(screen.getByText(expectedPage)).toBeTruthy();
    expect(screen.getByTestId('current-path').textContent).toBe(path);
  });

  it.each(['/orders', '/orders/507f1f77bcf86cd799439021'])(
    'redirects unauthenticated users from %s to Login',
    (path) => {
      mockAuth.current = {
        isAuthenticated: false,
        user: null,
      };

      show(path);

      expect(screen.getByText('Login page')).toBeTruthy();
      expect(screen.getByTestId('current-path').textContent).toBe('/login');

      expect(screen.queryByText('Customer order history page')).toBeNull();
      expect(screen.queryByText('Customer order details page')).toBeNull();
    },
  );

  it.each(['/orders', '/orders/507f1f77bcf86cd799439021'])(
    'blocks non-CUSTOMER access to %s',
    (path) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role: BRANCH_MANAGER },
      };

      show(path);

      expect(screen.getByText('Home page')).toBeTruthy();
      expect(screen.getByTestId('current-path').textContent).toBe('/');

      expect(screen.queryByText('Customer order history page')).toBeNull();
      expect(screen.queryByText('Customer order details page')).toBeNull();
    },
  );
});

describe('Staff order route protection', () => {
  const staffPaths = [
    ['/staff/orders', 'Staff orders page'],
    ['/staff/orders/507f1f77bcf86cd799439021', 'Staff order details page'],
  ];

  beforeEach(() => {
    mockAuth.current = {
      isAuthenticated: true,
      user: { role: BRANCH_ASSISTANT },
    };
  });

  it.each([BRANCH_ASSISTANT, BRANCH_MANAGER])(
    'allows %s to access staff order pages',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      for (const [path, expectedPage] of staffPaths) {
        const view = show(path);

        expect(screen.getByText(expectedPage)).toBeTruthy();
        expect(screen.getByTestId('current-path').textContent).toBe(path);

        view.unmount();
      }
    },
  );

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'denies %s access to staff orders',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      show('/staff/orders');

      expect(screen.getByText('Home page')).toBeTruthy();
      expect(screen.getByTestId('current-path').textContent).toBe('/');
      expect(screen.queryByText('Staff orders page')).toBeNull();
    },
  );

  it('redirects unauthenticated users to login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show('/staff/orders');

    expect(screen.getByText('Login page')).toBeTruthy();
    expect(screen.getByTestId('current-path').textContent).toBe('/login');
  });

  it('prevents customers from accessing staff order details', () => {
    mockAuth.current = {
      isAuthenticated: true,
      user: { role: CUSTOMER },
    };

    show('/staff/orders/507f1f77bcf86cd799439021');

    expect(screen.getByText('Home page')).toBeTruthy();
    expect(screen.queryByText('Staff order details page')).toBeNull();
  });
});

describe('System Admin Dashboard route protection', () => {
  it('allows SYSTEM_ADMIN to open the dashboard', () => {
    mockAuth.current = { isAuthenticated: true, user: { role: SYSTEM_ADMIN } };
    show('/admin');
    expect(
      screen.getByRole('heading', { name: /Admin Dashboard/i }),
    ).toBeInTheDocument();
  });

  it.each([CUSTOMER, BRANCH_MANAGER, BRANCH_ASSISTANT, OPTOMETRIST])(
    'blocks %s from the dashboard',
    (role) => {
      mockAuth.current = { isAuthenticated: true, user: { role } };
      show('/admin');
      expect(screen.getByTestId('current-path').textContent).toBe('/');
    },
  );

  it('redirects unauthenticated visitors to login', () => {
    mockAuth.current = { isAuthenticated: false, user: null };
    show('/admin');
    expect(screen.getByTestId('current-path').textContent).toBe('/login');
  });
});
describe('Admin Staff creation route protection', () => {
  it('allows SYSTEM_ADMIN to open the staff creation page', () => {
    mockAuth.current = { isAuthenticated: true, user: { role: SYSTEM_ADMIN } };
    show('/admin/staff/new');
    expect(
      screen.getByRole('heading', { name: 'Add New Staff Member' }),
    ).toBeInTheDocument();
  });

  it.each([CUSTOMER, BRANCH_ASSISTANT, BRANCH_MANAGER, OPTOMETRIST])(
    'denies %s from creating Staff',
    (role) => {
      mockAuth.current = { isAuthenticated: true, user: { role } };
      show('/admin/staff/new');
      expect(screen.getByTestId('current-path').textContent).toBe('/');
    },
  );

  it('sends unauthenticated visitors to Login', () => {
    mockAuth.current = { isAuthenticated: false, user: null };
    show('/admin/staff/new');
    expect(screen.getByTestId('current-path').textContent).toBe('/login');
  });
});
