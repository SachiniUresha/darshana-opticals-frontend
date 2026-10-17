import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      role: 'BRANCH_ASSISTANT',
    },
  },
}));

vi.mock('../src/hooks/useAuth', () => ({
  default: () => mockAuth.current,
}));

vi.mock('../src/layouts/AppLayout', () => ({
  default: () => <Outlet />,
}));

vi.mock('../src/pages/StaffAppointmentsPage', () => ({
  default: () => <div>Staff appointments page</div>,
}));

vi.mock('../src/pages/StaffCreateDoctorSessionPage', () => ({
  default: () => <div>Create doctor session page</div>,
}));

vi.mock('../src/pages/StaffDoctorSessionDetailsPage', () => ({
  default: () => <div>Doctor session details page</div>,
}));

vi.mock('../src/pages/StaffEditDoctorSessionPage', () => ({
  default: () => <div>Edit doctor session page</div>,
}));

vi.mock('../src/pages/StaffAppointmentDetailsPage', () => ({
  default: () => <div>Staff appointment details page</div>,
}));

vi.mock('../src/pages/StaffMoveAppointmentPage', () => ({
  default: () => <div>Move staff appointment page</div>,
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

function show(path = '/staff/appointments') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <CurrentLocation />
    </MemoryRouter>,
  );
}

describe('Staff appointment route protection', () => {
  beforeEach(() => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: BRANCH_ASSISTANT,
      },
    };
  });

  it.each([BRANCH_ASSISTANT, BRANCH_MANAGER])(
    'allows %s to access staff appointments',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      show();

      expect(screen.getByText('Staff appointments page')).toBeInTheDocument();

      expect(screen.getByTestId('current-path')).toHaveTextContent(
        '/staff/appointments',
      );
    },
  );

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from staff appointments',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      show();

      expect(screen.getByText('Home page')).toBeInTheDocument();

      expect(screen.getByTestId('current-path')).toHaveTextContent('/');
    },
  );

  it('redirects unauthenticated users from staff appointments to login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show();

    expect(screen.getByText('Login page')).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });

  it('allows Branch Assistant to access create doctor session', () => {
    show('/staff/appointments/sessions/new');

    expect(screen.getByText('Create doctor session page')).toBeInTheDocument();
  });

  it('blocks Branch Manager from create doctor session', () => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: BRANCH_MANAGER,
      },
    };

    show('/staff/appointments/sessions/new');

    expect(screen.getByText('Home page')).toBeInTheDocument();

    expect(
      screen.queryByText('Create doctor session page'),
    ).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users from create doctor session to login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show('/staff/appointments/sessions/new');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it.each([BRANCH_ASSISTANT, BRANCH_MANAGER])(
    'allows %s to view doctor session details',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      const path = '/staff/appointments/sessions/507f1f77bcf86cd799439021';

      show(path);

      expect(
        screen.getByText('Doctor session details page'),
      ).toBeInTheDocument();

      expect(screen.getByTestId('current-path')).toHaveTextContent(path);
    },
  );

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from doctor session details',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      show('/staff/appointments/sessions/507f1f77bcf86cd799439021');

      expect(screen.getByText('Home page')).toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users from doctor session details to login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show('/staff/appointments/sessions/507f1f77bcf86cd799439021');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('allows Branch Assistant to edit a doctor session', () => {
    const path = '/staff/appointments/sessions/507f1f77bcf86cd799439021/edit';

    show(path);

    expect(screen.getByText('Edit doctor session page')).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent(path);
  });

  it('blocks Branch Manager from editing a doctor session', () => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: BRANCH_MANAGER,
      },
    };

    show('/staff/appointments/sessions/507f1f77bcf86cd799439021/edit');

    expect(screen.getByText('Home page')).toBeInTheDocument();

    expect(
      screen.queryByText('Edit doctor session page'),
    ).not.toBeInTheDocument();
  });

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from editing a doctor session',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      show('/staff/appointments/sessions/507f1f77bcf86cd799439021/edit');

      expect(screen.getByText('Home page')).toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users from edit doctor session to login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show('/staff/appointments/sessions/507f1f77bcf86cd799439021/edit');

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it.each([BRANCH_ASSISTANT, BRANCH_MANAGER])(
    'allows %s to view staff appointment details',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      const path = '/staff/appointments/bookings/507f1f77bcf86cd799439031';

      show(path);

      expect(
        screen.getByText('Staff appointment details page'),
      ).toBeInTheDocument();

      expect(screen.getByTestId('current-path')).toHaveTextContent(path);
    },
  );

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from staff appointment details',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      show('/staff/appointments/bookings/507f1f77bcf86cd799439031');

      expect(screen.getByText('Home page')).toBeInTheDocument();

      expect(
        screen.queryByText('Staff appointment details page'),
      ).not.toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users from staff appointment details to login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show('/staff/appointments/bookings/507f1f77bcf86cd799439031');

    expect(screen.getByText('Login page')).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });

  it('allows Branch Assistant to move a customer booking', () => {
    const path = '/staff/appointments/bookings/507f1f77bcf86cd799439031/move';

    show(path);

    expect(screen.getByText('Move staff appointment page')).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent(path);
  });

  it('blocks Branch Manager from moving a customer booking', () => {
    mockAuth.current = {
      isAuthenticated: true,
      user: {
        role: BRANCH_MANAGER,
      },
    };

    show('/staff/appointments/bookings/507f1f77bcf86cd799439031/move');

    expect(screen.getByText('Home page')).toBeInTheDocument();

    expect(
      screen.queryByText('Move staff appointment page'),
    ).not.toBeInTheDocument();
  });

  it.each([CUSTOMER, OPTOMETRIST, SYSTEM_ADMIN])(
    'blocks %s from moving a customer booking',
    (role) => {
      mockAuth.current = {
        isAuthenticated: true,
        user: { role },
      };

      show('/staff/appointments/bookings/507f1f77bcf86cd799439031/move');

      expect(screen.getByText('Home page')).toBeInTheDocument();

      expect(
        screen.queryByText('Move staff appointment page'),
      ).not.toBeInTheDocument();
    },
  );

  it('redirects unauthenticated users from move booking to login', () => {
    mockAuth.current = {
      isAuthenticated: false,
      user: null,
    };

    show('/staff/appointments/bookings/507f1f77bcf86cd799439031/move');

    expect(screen.getByText('Login page')).toBeInTheDocument();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
  });
});
