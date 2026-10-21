import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleSidebar from '../src/components/staff/RoleSidebar';
import AppLayout from '../src/layouts/AppLayout';
import useAuth from '../src/hooks/useAuth';
import { useBranches } from '../src/hooks/useBranches';
import {
  BRANCH_MANAGER,
  BRANCH_ASSISTANT,
  OPTOMETRIST,
} from '../src/config/roles';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/hooks/useBranches');

function setRole(role) {
  useAuth.mockReturnValue({
    user: { id: 'test-user', role, name: 'Nimal Perera', branchId: 'branch-1' },
    isAuthenticated: true,
    logout: vi.fn(),
  });
}

function renderSidebar(path = '/staff/orders') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RoleSidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useBranches.mockReturnValue({
    branches: [{ id: 'branch-1', address: 'Gampaha Main Branch' }],
    loading: false,
    error: null,
    retry: vi.fn(),
    unauthorized: false,
  });
});

describe('Approved role-based navigation', () => {
  it('shows the six existing Manager destinations, no new Dashboard', () => {
    setRole(BRANCH_MANAGER);
    renderSidebar();
    const expected = [
      ['Order Management', '/staff/orders'],
      ['Appointments', '/staff/appointments'],
      ['Inventory', '/staff/inventory'],
      ['Sales Reports', '/staff/reports/sales'],
      ['Inventory Reports', '/staff/reports/inventory'],
      ['Loyalty Monitoring', '/staff/loyalty'],
    ];
    for (const [label, path] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        path,
      );
    }
    expect(
      screen.queryByRole('link', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /men.s frames/i }),
    ).not.toBeInTheDocument();
  });

  it('limits Assistant to Orders and Appointments, with logout visible', () => {
    setRole(BRANCH_ASSISTANT);
    renderSidebar();
    const navigation = screen.getByRole('navigation', {
      name: 'Staff navigation',
    });
    expect(navigation.querySelectorAll('a')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Order Management' }),
    ).toHaveAttribute('href', '/staff/orders');
    expect(
      screen.getByRole('link', { name: 'Appointments' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Inventory' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('preserves the existing Manager/Assistant clickable name-role-branch details', async () => {
    setRole(BRANCH_ASSISTANT);
    renderSidebar();
    const trigger = screen.getByRole('button', { name: 'View staff identity' });
    expect(trigger).toHaveTextContent('Branch Assistant');
    await userEvent.setup().click(trigger);
    const panel = screen.getByRole('region', {
      name: 'Staff identity details',
    });
    expect(panel).toHaveTextContent('Nimal Perera');
    expect(panel).toHaveTextContent('Branch Assistant');
    expect(panel).toHaveTextContent('Gampaha Main Branch');
    await userEvent.setup().keyboard('{Escape}');
    expect(
      screen.queryByRole('region', { name: 'Staff identity details' }),
    ).not.toBeInTheDocument();
  });

  it('gives Optometrist only Prescription Handling and Name/Role, without branch API access', () => {
    setRole(OPTOMETRIST);
    renderSidebar('/clinical/prescriptions/new');
    expect(
      screen.getByRole('link', { name: 'Prescription Handling' }),
    ).toHaveAttribute('href', '/clinical/prescriptions/new');
    expect(screen.getByText('Nimal Perera')).toBeInTheDocument();
    expect(screen.getByText('Optometrist')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'View staff identity' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Assigned Branch')).not.toBeInTheDocument();
    expect(useBranches).not.toHaveBeenCalled();
  });

  it('logs out through the same existing auth hook', async () => {
    setRole(OPTOMETRIST);
    const logout = vi.fn();
    useAuth.mockReturnValue({
      user: { id: 'test-user', role: OPTOMETRIST, name: 'Nimal Perera' },
      isAuthenticated: true,
      logout,
    });
    renderSidebar('/clinical/prescriptions/new');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Log Out' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows the sidebar instead of Navbar only on matching staff/clinical routes', () => {
    setRole(BRANCH_ASSISTANT);
    render(
      <MemoryRouter initialEntries={['/staff/orders']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              path="/staff/orders"
              element={<h1>Existing orders page</h1>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('navigation', { name: 'Staff navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Existing orders page' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Main navigation' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
