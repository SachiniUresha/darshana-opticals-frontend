import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import { BRANCH_MANAGER, CUSTOMER } from '../config/roles';

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
