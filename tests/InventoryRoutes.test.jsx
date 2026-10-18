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
vi.mock('../src/pages/InventoryPage', () => ({
  default: () => <h1>Inventory overview</h1>,
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

describe('Inventory staff role protection', () => {
  it('allows Branch Manager on the staff inventory route', () => {
    show('/staff/inventory');
    expect(
      screen.getByRole('heading', { name: 'Inventory overview' }),
    ).toBeInTheDocument();
  });

  it('allows System Admin on the admin inventory route', () => {
    auth.value = { isAuthenticated: true, user: { role: SYSTEM_ADMIN } };
    show('/admin/inventory');
    expect(
      screen.getByRole('heading', { name: 'Inventory overview' }),
    ).toBeInTheDocument();
  });

  it.each([BRANCH_ASSISTANT, CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from manager inventory',
    (role) => {
      auth.value = { isAuthenticated: true, user: { role } };
      show('/staff/inventory');
      expect(
        screen.getByRole('heading', { name: 'Home destination' }),
      ).toBeInTheDocument();
    },
  );

  it('blocks Branch Manager from System Admin inventory route', () => {
    show('/admin/inventory');
    expect(
      screen.getByRole('heading', { name: 'Home destination' }),
    ).toBeInTheDocument();
  });

  it('redirects guests to login before showing inventory', () => {
    auth.value = { isAuthenticated: false, user: null };
    show('/staff/inventory');
    expect(
      screen.getByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();
  });
});
