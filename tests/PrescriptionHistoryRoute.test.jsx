import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppRoutes from '../src/routes/AppRoutes';
import useAuth from '../src/hooks/useAuth';
import { CUSTOMER, OPTOMETRIST, BRANCH_MANAGER } from '../src/config/roles';

vi.mock('../src/hooks/useAuth');

vi.mock('../src/layouts/AppLayout', () => ({
  default: () => <Outlet />,
}));

vi.mock('../src/pages/PrescriptionHistoryPage', () => ({
  default: () => <h1>Customer Prescription History Screen</h1>,
}));

vi.mock('../src/pages/ProfilePage', () => ({
  default: () => <h1>Customer Profile Screen</h1>,
}));

vi.mock('../src/pages/LoginPage', () => ({
  default: () => <h1>Login Screen</h1>,
}));

vi.mock('../src/pages/HomePage', () => ({
  default: () => <h1>Home Screen</h1>,
}));

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

function renderRoute(authState) {
  useAuth.mockReturnValue(authState);

  return render(
    <MemoryRouter initialEntries={['/profile/prescriptions']}>
      <AppRoutes />
      <CurrentPath />
    </MemoryRouter>,
  );
}

describe('Customer Prescription History route protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows an authenticated CUSTOMER to view history', () => {
    renderRoute({
      isAuthenticated: true,
      user: { role: CUSTOMER },
    });

    expect(
      screen.getByRole('heading', {
        name: 'Customer Prescription History Screen',
      }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/profile/prescriptions',
    );
  });

  it('redirects unauthenticated users to login', () => {
    renderRoute({
      isAuthenticated: false,
      user: null,
    });

    expect(
      screen.getByRole('heading', { name: 'Login Screen' }),
    ).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });

  it.each([OPTOMETRIST, BRANCH_MANAGER])(
    'blocks unauthorized role %s',
    (role) => {
      renderRoute({
        isAuthenticated: true,
        user: { role },
      });

      expect(
        screen.getByRole('heading', { name: 'Home Screen' }),
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('heading', {
          name: 'Customer Prescription History Screen',
        }),
      ).not.toBeInTheDocument();

      expect(screen.getByTestId('current-path')).toHaveTextContent('/');
    },
  );
});
