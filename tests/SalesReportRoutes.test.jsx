import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation } from 'react-router-dom';
import AppRoutes from '../src/routes/AppRoutes';
import {
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
  CUSTOMER,
  OPTOMETRIST,
  SYSTEM_ADMIN,
} from '../src/config/roles';

const auth = vi.hoisted(() => ({
  value: { isAuthenticated: true, user: { role: 'BRANCH_MANAGER' } },
}));
vi.mock('../src/hooks/useAuth', () => ({ default: () => auth.value }));
vi.mock('../src/layouts/AppLayout', () => ({ default: () => <Outlet /> }));
vi.mock('../src/pages/SalesReportPage', () => ({
  default: () => <h1>Sales reporting workspace</h1>,
}));
vi.mock('../src/pages/HomePage', () => ({
  default: () => <h1>Home destination</h1>,
}));
vi.mock('../src/pages/LoginPage', () => ({
  default: () => <h1>Login destination</h1>,
}));

function Location() {
  const location = useLocation();
  return <output data-testid="path">{location.pathname}</output>;
}

function show(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <Location />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.value = { isAuthenticated: true, user: { role: BRANCH_MANAGER } };
});

describe('DDP-064 sales reporting route permissions', () => {
  it('allows Branch Manager in staff reporting', () => {
    show('/staff/reports/sales');
    expect(
      screen.getByRole('heading', { name: 'Sales reporting workspace' }),
    ).toBeInTheDocument();
  });

  it('allows System Admin in admin reporting', () => {
    auth.value = { isAuthenticated: true, user: { role: SYSTEM_ADMIN } };
    show('/admin/reports/sales');
    expect(
      screen.getByRole('heading', { name: 'Sales reporting workspace' }),
    ).toBeInTheDocument();
  });

  it.each([BRANCH_ASSISTANT, CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'denies %s in the Branch Manager reporting route',
    (role) => {
      auth.value = { isAuthenticated: true, user: { role } };
      show('/staff/reports/sales');
      expect(
        screen.getByRole('heading', { name: 'Home destination' }),
      ).toBeInTheDocument();
    },
  );

  it('denies Branch Manager in the admin reporting route', () => {
    show('/admin/reports/sales');
    expect(
      screen.getByRole('heading', { name: 'Home destination' }),
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated users to Login', () => {
    auth.value = { isAuthenticated: false, user: null };
    show('/staff/reports/sales');
    expect(
      screen.getByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();
  });
});
