import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffAppointmentsPage from '../src/pages/StaffAppointmentsPage';
import useAuth from '../src/hooks/useAuth';
import {
  getAppointmentProviders,
  getDoctorSessions,
  getStaffAppointments,
} from '../src/services/staffAppointmentService';
import { BRANCH_ASSISTANT, BRANCH_MANAGER } from '../src/config/roles';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/staffAppointmentService', () => ({
  getAppointmentProviders: vi.fn(),
  getDoctorSessions: vi.fn(),
  getStaffAppointments: vi.fn(),
}));

const logout = vi.fn();

const futureStart = new Date(
  Date.now() + 7 * 24 * 60 * 60 * 1000,
).toISOString();

const futureEnd = new Date(
  Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000,
).toISOString();

const session = {
  id: '507f1f77bcf86cd799439021',
  staffId: '507f1f77bcf86cd799439011',
  branchId: '507f1f77bcf86cd799439012',
  startAt: futureStart,
  endAt: futureEnd,
  capacity: 10,
  confirmedCount: 3,
  remainingCapacity: 7,
};

const provider = {
  id: session.staffId,
  name: 'Dr. N. Silva',
  role: 'OPTOMETRIST',
  branchId: session.branchId,
};

const appointment = {
  id: '507f1f77bcf86cd799439031',
  staffId: provider.id,
  providerName: provider.name,
  sessionId: session.id,
  branchId: session.branchId,
  dateTime: futureStart,
  status: 'CONFIRMED',
  position: 2,
  customer: {
    id: '507f1f77bcf86cd799439041',
    name: 'Customer C',
    phone: '0771234567',
  },
};

function renderPage(initialPath = '/staff/appointments') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/staff/appointments" element={<StaffAppointmentsPage />} />
        <Route path="/login" element={<div>Login marker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function waitForSessionData() {
  await screen.findByRole('link', {
    name: 'View ›',
  });
}

describe('StaffAppointmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: {
        role: BRANCH_ASSISTANT,
      },
      logout,
    });

    getAppointmentProviders.mockResolvedValue([provider]);
    getDoctorSessions.mockResolvedValue([session]);
    getStaffAppointments.mockResolvedValue([appointment]);
  });

  it('loads the Branch Assistant doctor-session overview', async () => {
    renderPage();

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();

    await waitForSessionData();

    expect(screen.getAllByText('Dr. N. Silva').length).toBeGreaterThan(0);

    expect(
      screen.getByRole('link', {
        name: '+ Create Doctor Session',
      }),
    ).toHaveAttribute('href', '/staff/appointments/sessions/new');

    expect(getAppointmentProviders).toHaveBeenCalledTimes(1);
    expect(getDoctorSessions).toHaveBeenCalledTimes(1);
    expect(getStaffAppointments).toHaveBeenCalledTimes(1);
  });

  it('keeps Branch Manager read-only and does not request providers', async () => {
    useAuth.mockReturnValue({
      user: {
        role: BRANCH_MANAGER,
      },
      logout,
    });

    renderPage();

    expect(await screen.findByText('Read-only access')).toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: '+ Create Doctor Session',
      }),
    ).not.toBeInTheDocument();

    expect(getAppointmentProviders).not.toHaveBeenCalled();
  });

  it('shows backend-derived appointment metrics', async () => {
    renderPage();

    await waitForSessionData();

    const summary = screen.getByLabelText('Appointment summary');

    expect(within(summary).getByText('Upcoming Sessions')).toBeInTheDocument();

    expect(within(summary).getByText('Confirmed Bookings')).toBeInTheDocument();

    expect(within(summary).getByText('Available Places')).toBeInTheDocument();

    expect(within(summary).getByText('7')).toBeInTheDocument();
  });

  it('switches to the customer bookings tab', async () => {
    renderPage();

    await waitForSessionData();

    fireEvent.click(
      screen.getByRole('tab', {
        name: 'Customer Bookings',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Customer Bookings',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Customer C')).toBeInTheDocument();

    const bookingsTable = screen.getByRole('table');

    expect(within(bookingsTable).getByText('Confirmed')).toBeInTheDocument();
  });

  it('does not show customer identity to Branch Manager', async () => {
    useAuth.mockReturnValue({
      user: {
        role: BRANCH_MANAGER,
      },
      logout,
    });

    renderPage('/staff/appointments?tab=bookings');

    expect(await screen.findByText('Restricted')).toBeInTheDocument();

    expect(screen.queryByText('Customer C')).not.toBeInTheDocument();
  });

  it('shows the doctor-session empty state', async () => {
    getDoctorSessions.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText('No doctor sessions found'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Clear Filters',
      }),
    ).toBeInTheDocument();
  });

  it('shows the customer-booking empty state', async () => {
    getStaffAppointments.mockResolvedValue([]);

    renderPage('/staff/appointments?tab=bookings');

    expect(
      await screen.findByText('No customer bookings found'),
    ).toBeInTheDocument();
  });

  it('logs out and redirects on 401', async () => {
    getDoctorSessions.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
      }),
    );

    renderPage();

    expect(await screen.findByText('Login marker')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows an access-denied state on 403 without exposing data', async () => {
    getDoctorSessions.mockRejectedValue(
      Object.assign(new Error('Forbidden'), {
        status: 403,
      }),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to view appointments',
    );

    expect(screen.queryByText('Customer C')).not.toBeInTheDocument();
  });

  it('shows a safe general error without exposing backend details', async () => {
    getDoctorSessions.mockRejectedValue(
      Object.assign(new Error('Mongo connection secret internal error'), {
        status: 500,
      }),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load appointments',
    );

    expect(
      screen.queryByText('Mongo connection secret internal error'),
    ).not.toBeInTheDocument();
  });

  it('filters sessions by optometrist search', async () => {
    renderPage();

    await waitForSessionData();

    fireEvent.change(screen.getByPlaceholderText('Search doctor...'), {
      target: {
        value: 'different doctor',
      },
    });

    expect(screen.getByText('No doctor sessions found')).toBeInTheDocument();
  });

  it('finishes the loading state after data is returned', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Loading sessions...')).not.toBeInTheDocument();
    });
  });
});
