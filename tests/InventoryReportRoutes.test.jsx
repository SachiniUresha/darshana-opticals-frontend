import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
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
vi.mock('../src/pages/InventoryReportPage', () => ({
  default: () => <h1>Inventory reporting workspace</h1>,
}));
vi.mock('../src/pages/HomePage', () => ({
  default: () => <h1>Home destination</h1>,
}));
vi.mock('../src/pages/LoginPage', () => ({
  default: () => <h1>Login destination</h1>,
}));

function show(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.value = { isAuthenticated: true, user: { role: BRANCH_MANAGER } };
});

describe('DDP-064 inventory reporting route permissions', () => {
  it('allows a Branch Manager into staff reporting', () => {
    show('/staff/reports/inventory');
    expect(
      screen.getByRole('heading', { name: 'Inventory reporting workspace' }),
    ).toBeInTheDocument();
  });

  it('allows a System Admin into admin reporting', () => {
    auth.value = { isAuthenticated: true, user: { role: SYSTEM_ADMIN } };
    show('/admin/reports/inventory');
    expect(
      screen.getByRole('heading', { name: 'Inventory reporting workspace' }),
    ).toBeInTheDocument();
  });

  it.each([BRANCH_ASSISTANT, CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'denies %s from the Branch Manager route',
    (role) => {
      auth.value = { isAuthenticated: true, user: { role } };
      show('/staff/reports/inventory');
      expect(
        screen.getByRole('heading', { name: 'Home destination' }),
      ).toBeInTheDocument();
    },
  );

  it('denies Branch Manager from System Admin reporting', () => {
    show('/admin/reports/inventory');
    expect(
      screen.getByRole('heading', { name: 'Home destination' }),
    ).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    auth.value = { isAuthenticated: false, user: null };
    show('/staff/reports/inventory');
    expect(
      screen.getByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();
  });
});
