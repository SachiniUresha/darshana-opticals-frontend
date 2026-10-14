import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffEditDoctorSessionPage from '../src/pages/StaffEditDoctorSessionPage';
import useAuth from '../src/hooks/useAuth';
import {
  getAppointmentProviders,
  getDoctorSessions,
  getStaffAppointments,
  updateDoctorSession,
} from '../src/services/staffAppointmentService';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/staffAppointmentService', () => ({
  getAppointmentProviders: vi.fn(),
  getDoctorSessions: vi.fn(),
  getStaffAppointments: vi.fn(),
  updateDoctorSession: vi.fn(),
}));

const logout = vi.fn();

const session = {
  id: '507f1f77bcf86cd799439021',
  staffId: '507f1f77bcf86cd799439011',
  branchId: '507f1f77bcf86cd799439012',
  startAt: '2026-10-20T07:30:00.000Z',
  endAt: '2026-10-20T08:30:00.000Z',
  capacity: 10,
  confirmedCount: 2,
  remainingCapacity: 8,
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
  dateTime: session.startAt,
  status: 'CONFIRMED',
  position: 1,
};

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[`/staff/appointments/sessions/${session.id}/edit`]}
    >
      <Routes>
        <Route
          path="/staff/appointments/sessions/:sessionId/edit"
          element={<StaffEditDoctorSessionPage />}
        />

        <Route
          path="/staff/appointments/sessions/:sessionId"
          element={<div>Session details marker</div>}
        />

        <Route path="/login" element={<div>Login marker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function waitForForm() {
  await screen.findByRole('heading', {
    name: 'Edit / Reschedule Doctor Session',
  });
}

describe('StaffEditDoctorSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    getDoctorSessions.mockResolvedValue([session]);
    getAppointmentProviders.mockResolvedValue([provider]);
    getStaffAppointments.mockResolvedValue([
      appointment,
      {
        ...appointment,
        id: '507f1f77bcf86cd799439032',
        position: 2,
      },
    ]);

    updateDoctorSession.mockResolvedValue({
      ...session,
      capacity: 12,
    });
  });

  it('pre-fills the existing backend session', async () => {
    renderPage();

    await waitForForm();

    expect(screen.getByDisplayValue('Dr. N. Silva')).toBeInTheDocument();

    expect(screen.getByDisplayValue('10')).toBeInTheDocument();

    expect(screen.getByText('2 CONFIRMED')).toBeInTheDocument();
  });

  it('shows the confirmation modal before saving changes', async () => {
    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Capacity *'), {
      target: {
        value: '12',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: 'Confirm Session Reschedule',
      }),
    ).toBeInTheDocument();

    expect(updateDoctorSession).not.toHaveBeenCalled();
  });

  it('saves only after explicit confirmation', async () => {
    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Capacity *'), {
      target: {
        value: '12',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    await waitFor(() => {
      expect(updateDoctorSession).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          staffId: provider.id,
          branchId: provider.branchId,
          capacity: 12,
        }),
      );
    });

    expect(
      await screen.findByText('Session details marker'),
    ).toBeInTheDocument();
  });

  it('does not allow capacity below confirmed bookings', async () => {
    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Capacity *'), {
      target: {
        value: '1',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Capacity cannot be lower than the confirmed bookings',
    );

    expect(updateDoctorSession).not.toHaveBeenCalled();
  });

  it('rejects an invalid time range locally', async () => {
    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Start Time *'), {
      target: {
        value: '15:00',
      },
    });

    fireEvent.change(screen.getByLabelText('End Time *'), {
      target: {
        value: '14:00',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'End time must be later than the start time.',
    );

    expect(updateDoctorSession).not.toHaveBeenCalled();
  });

  it('shows backend overlap conflicts safely', async () => {
    updateDoctorSession.mockRejectedValue(
      Object.assign(new Error('Overlap details'), {
        status: 409,
        code: 'OVERLAPPING_SESSION',
      }),
    );

    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Capacity *'), {
      target: {
        value: '12',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'another session that overlaps',
    );

    expect(screen.queryByText('Overlap details')).not.toBeInTheDocument();
  });

  it('shows backend capacity conflicts safely', async () => {
    updateDoctorSession.mockRejectedValue(
      Object.assign(new Error('Capacity details'), {
        status: 409,
        code: 'CAPACITY_TOO_LOW',
      }),
    );

    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Capacity *'), {
      target: {
        value: '12',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Capacity cannot be reduced below the number of confirmed active bookings.',
    );
  });

  it('can cancel the confirmation without submitting', async () => {
    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Capacity *'), {
      target: {
        value: '12',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Keep Current Session',
      }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(updateDoctorSession).not.toHaveBeenCalled();
  });

  it('logs out and redirects when loading returns 401', async () => {
    getDoctorSessions.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
      }),
    );

    renderPage();

    expect(await screen.findByText('Login marker')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
