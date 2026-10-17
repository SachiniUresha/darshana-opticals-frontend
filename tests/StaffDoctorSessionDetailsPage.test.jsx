import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffDoctorSessionDetailsPage from '../src/pages/StaffDoctorSessionDetailsPage';
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

const doctor = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. N. Silva',
  specialization: 'Ophthalmologist',
};

const session = {
  id: '507f1f77bcf86cd799439021',
  doctorId: doctor.id,
  doctor: {
    id: doctor.id,
    name: doctor.name,
    specialization: doctor.specialization,
  },
  doctorName: doctor.name,
  specialization: doctor.specialization,
  branchId: '507f1f77bcf86cd799439012',
  startAt: '2026-10-20T07:30:00.000Z',
  endAt: '2026-10-20T08:30:00.000Z',
  capacity: 10,
  confirmedCount: 1,
  remainingCapacity: 9,
};

const otherSession = {
  ...session,
  id: '507f1f77bcf86cd799439099',
};

const appointment = {
  id: '507f1f77bcf86cd799439031',
  doctorId: doctor.id,
  doctor: {
    id: doctor.id,
    name: doctor.name,
    specialization: doctor.specialization,
  },
  doctorName: doctor.name,
  specialization: doctor.specialization,
  sessionId: session.id,
  branchId: session.branchId,
  dateTime: session.startAt,
  status: 'CONFIRMED',
  position: 1,
  customer: {
    id: '507f1f77bcf86cd799439041',
    name: 'Customer A',
    phone: '0771234567',
  },
};

const unrelatedAppointment = {
  ...appointment,
  id: '507f1f77bcf86cd799439088',
  sessionId: otherSession.id,
  customer: {
    id: '507f1f77bcf86cd799439077',
    name: 'Customer B',
    phone: '0710000000',
  },
};

function renderPage(path = `/staff/appointments/sessions/${session.id}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/staff/appointments/sessions/:sessionId"
          element={<StaffDoctorSessionDetailsPage />}
        />

        <Route path="/login" element={<div>Login marker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StaffDoctorSessionDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: {
        role: BRANCH_ASSISTANT,
      },
      logout,
    });

    getDoctorSessions.mockResolvedValue([session, otherSession]);

    getStaffAppointments.mockResolvedValue([appointment, unrelatedAppointment]);

    getAppointmentProviders.mockResolvedValue([doctor]);
  });

  it('loads authoritative doctor session details and metrics', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Doctor Session Details',
      }),
    ).toBeInTheDocument();

    const summary = screen.getByLabelText('Doctor session summary');

    expect(within(summary).getByText('10')).toBeInTheDocument();

    expect(within(summary).getByText('9')).toBeInTheDocument();

    expect(screen.getAllByText('Dr. N. Silva').length).toBeGreaterThan(0);

    expect(screen.getByText(/Ophthalmologist/)).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', {
        name: 'Doctor',
      }),
    ).toBeInTheDocument();
  });

  it('shows only bookings belonging to the requested session', async () => {
    renderPage();

    expect(await screen.findByText('Customer A')).toBeInTheDocument();

    expect(screen.queryByText('Customer B')).not.toBeInTheDocument();

    expect(screen.getByText('1 confirmed appointment')).toBeInTheDocument();
  });

  it('shows operational edit controls to Branch Assistant', async () => {
    renderPage();

    const editLink = await screen.findByRole('link', {
      name: 'Edit / Reschedule Session',
    });

    expect(editLink).toHaveAttribute(
      'href',
      `/staff/appointments/sessions/${session.id}/edit`,
    );
  });

  it('keeps Branch Manager read-only and hides customer identity', async () => {
    useAuth.mockReturnValue({
      user: {
        role: BRANCH_MANAGER,
      },
      logout,
    });

    getAppointmentProviders.mockClear();

    renderPage();

    expect(
      await screen.findByText('Your Branch Manager access is read-only.'),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Edit / Reschedule Session',
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByText('Restricted')).toBeInTheDocument();

    expect(screen.queryByText('Customer A')).not.toBeInTheDocument();

    expect(getAppointmentProviders).not.toHaveBeenCalled();
  });

  it('shows a safe not-found state when the requested session is absent', async () => {
    getDoctorSessions.mockResolvedValue([otherSession]);

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Doctor session not found',
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText('Customer A')).not.toBeInTheDocument();
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

  it('shows a safe access error on 403', async () => {
    getDoctorSessions.mockRejectedValue(
      Object.assign(new Error('Forbidden details'), {
        status: 403,
      }),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to view this doctor session.',
    );

    expect(screen.queryByText('Forbidden details')).not.toBeInTheDocument();
  });

  it('shows a safe network error', async () => {
    getDoctorSessions.mockRejectedValue(
      Object.assign(new Error('Network internals'), {
        status: 0,
      }),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the server. Please check your connection and try again.',
    );

    expect(screen.queryByText('Network internals')).not.toBeInTheDocument();
  });
});
