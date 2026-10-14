import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('../src/pages/AppointmentHistoryPage', () => ({
  default: () => <div>Appointment history page</div>,
}));

vi.mock('../src/pages/AppointmentBookingPage', () => ({
  default: () => <div>Appointment booking page</div>,
}));

vi.mock('../src/pages/AppointmentDetailsPage', () => ({
  default: () => <div>Appointment details page</div>,
}));

vi.mock('../src/pages/LoginPage', () => ({
  default: () => <div>Login page</div>,
}));

vi.mock('../src/pages/HomePage', () => ({
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

describe('Customer appointment route protection', () => {
  beforeEach(() => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: CUSTOMER,
      },
    };
  });

  it.each([
    ['/appointments', 'Appointment history page'],
    ['/appointments/book', 'Appointment booking page'],
    ['/appointments/507f1f77bcf86cd799439021', 'Appointment details page'],
  ])('allows CUSTOMER access to %s', (path, expectedPage) => {
    show(path);

    expect(screen.getByText(expectedPage)).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent(path);
  });

  it.each([
    '/appointments',
    '/appointments/book',
    '/appointments/507f1f77bcf86cd799439021',
  ])('redirects unauthenticated users from %s to login', (path) => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show(path);

    expect(screen.getByText('Login page')).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });

  it.each([
    '/appointments',
    '/appointments/book',
    '/appointments/507f1f77bcf86cd799439021',
  ])('blocks non-CUSTOMER access to %s', (path) => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: BRANCH_MANAGER,
      },
    };

    show(path);

    expect(screen.getByText('Home page')).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
  });
});
