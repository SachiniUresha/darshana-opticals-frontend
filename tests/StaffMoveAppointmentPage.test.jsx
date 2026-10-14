import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffMoveAppointmentPage from '../src/pages/StaffMoveAppointmentPage';
import useAuth from '../src/hooks/useAuth';
import {
  getAppointmentProviders,
  getDoctorSessions,
  getStaffAppointment,
  reassignStaffAppointment,
} from '../src/services/staffAppointmentService';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/staffAppointmentService', () => ({
  getAppointmentProviders: vi.fn(),
  getDoctorSessions: vi.fn(),
  getStaffAppointment: vi.fn(),
  reassignStaffAppointment: vi.fn(),
}));

const logout = vi.fn();

const sourceSessionId = '507f1f77bcf86cd799439021';

const targetSessionId = '507f1f77bcf86cd799439099';

const provider = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. N. Silva',
  role: 'OPTOMETRIST',
  branchId: '507f1f77bcf86cd799439012',
};

const targetProvider = {
  id: '507f1f77bcf86cd799439055',
  name: 'Dr. P. Perera',
  role: 'OPTOMETRIST',
  branchId: provider.branchId,
};

function futureIso(days, hours = 0) {
  return new Date(
    Date.now() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000,
  ).toISOString();
}

const appointment = {
  id: '507f1f77bcf86cd799439031',
  staffId: provider.id,
  providerName: provider.name,
  sessionId: sourceSessionId,
  branchId: provider.branchId,
  dateTime: futureIso(3),
  status: 'CONFIRMED',
  position: 2,
  customer: {
    id: '507f1f77bcf86cd799439041',
    name: 'Customer A',
    phone: '0771234567',
  },
};

const sourceSession = {
  id: sourceSessionId,
  staffId: provider.id,
  branchId: provider.branchId,
  startAt: appointment.dateTime,
  endAt: futureIso(3, 1),
  capacity: 10,
  confirmedCount: 3,
  remainingCapacity: 7,
};

const targetSession = {
  id: targetSessionId,
  staffId: targetProvider.id,
  branchId: provider.branchId,
  startAt: futureIso(7),
  endAt: futureIso(7, 1),
  capacity: 8,
  confirmedCount: 3,
  remainingCapacity: 5,
};

const reassignedAppointment = {
  ...appointment,
  staffId: targetProvider.id,
  providerName: targetProvider.name,
  sessionId: targetSession.id,
  dateTime: targetSession.startAt,
  position: 4,
};

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[`/staff/appointments/bookings/${appointment.id}/move`]}
    >
      <Routes>
        <Route
          path="/staff/appointments/bookings/:appointmentId/move"
          element={<StaffMoveAppointmentPage />}
        />

        <Route
          path="/staff/appointments/bookings/:appointmentId"
          element={<div>Appointment details marker</div>}
        />

        <Route path="/login" element={<div>Login marker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function selectTargetSession() {
  await screen.findByText('Dr. P. Perera');

  fireEvent.click(screen.getByRole('radio'));
}

describe('StaffMoveAppointmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    getStaffAppointment.mockResolvedValue(appointment);

    getDoctorSessions.mockResolvedValue([sourceSession, targetSession]);

    getAppointmentProviders.mockResolvedValue([provider, targetProvider]);

    reassignStaffAppointment.mockResolvedValue({
      success: true,
    });
  });

  it('shows eligible target sessions and excludes the current session', async () => {
    renderPage();

    expect(await screen.findByText('Dr. P. Perera')).toBeInTheDocument();

    expect(screen.getByText('5')).toBeInTheDocument();

    const targetSessionOptions = screen.getAllByRole('radio');

    expect(targetSessionOptions).toHaveLength(1);

    expect(targetSessionOptions[0]).toHaveAttribute('value', targetSession.id);

    expect(targetSessionOptions[0]).not.toHaveAttribute(
      'value',
      sourceSession.id,
    );
  });

  it('requires a target session before confirmation', async () => {
    renderPage();

    await screen.findByText('Dr. P. Perera');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review Move',
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select an available target doctor session first.',
    );

    expect(reassignStaffAppointment).not.toHaveBeenCalled();
  });

  it('shows confirmation before reassigning', async () => {
    renderPage();

    await selectTargetSession();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review Move',
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: 'Confirm Booking Move',
      }),
    ).toBeInTheDocument();

    expect(reassignStaffAppointment).not.toHaveBeenCalled();
  });

  it('reassigns using only the selected session id and reloads authoritative appointment data', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce(reassignedAppointment);

    renderPage();

    await selectTargetSession();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review Move',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Move',
      }),
    );

    await waitFor(() => {
      expect(reassignStaffAppointment).toHaveBeenCalledWith(
        appointment.id,
        targetSession.id,
      );
    });

    expect(getStaffAppointment).toHaveBeenCalledTimes(2);

    expect(
      await screen.findByText('Appointment details marker'),
    ).toBeInTheDocument();
  });

  it('shows full-session conflicts safely', async () => {
    reassignStaffAppointment.mockRejectedValue(
      Object.assign(new Error('Internal capacity detail'), {
        status: 409,
        code: 'SESSION_FULL',
      }),
    );

    renderPage();

    await selectTargetSession();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review Move',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Move',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'selected target session is full',
    );

    expect(
      screen.queryByText('Internal capacity detail'),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['BOOKING_WINDOW', 'at least 24 hours away'],
    ['DUPLICATE_BOOKING', 'already has a confirmed booking'],
    ['SAME_SESSION', 'already assigned to that doctor session'],
    ['SESSION_CHANGED', 'source session changed'],
    ['INVALID_STATUS', 'Only confirmed appointments can be moved'],
  ])(
    'shows %s reassignment conflicts safely',
    async (code, expectedMessage) => {
      reassignStaffAppointment.mockRejectedValue(
        Object.assign(new Error('Internal conflict'), {
          status: 409,
          code,
        }),
      );

      renderPage();

      await selectTargetSession();

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Review Move',
        }),
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Confirm Move',
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        expectedMessage,
      );

      expect(screen.queryByText('Internal conflict')).not.toBeInTheDocument();
    },
  );

  it('prevents duplicate move submission while pending', async () => {
    let resolveMove;

    reassignStaffAppointment.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMove = resolve;
        }),
    );

    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce(reassignedAppointment);

    renderPage();

    await selectTargetSession();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Review Move',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Move',
      }),
    );

    const pendingButton = await screen.findByRole('button', {
      name: 'Moving Booking...',
    });

    expect(pendingButton).toBeDisabled();

    fireEvent.click(pendingButton);

    expect(reassignStaffAppointment).toHaveBeenCalledTimes(1);

    resolveMove({
      success: true,
    });

    expect(
      await screen.findByText('Appointment details marker'),
    ).toBeInTheDocument();
  });

  it('shows a safe state for cancelled appointments', async () => {
    getStaffAppointment.mockResolvedValue({
      ...appointment,
      status: 'CANCELLED',
      position: null,
    });

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Booking cannot be moved',
      }),
    ).toBeInTheDocument();

    expect(reassignStaffAppointment).not.toHaveBeenCalled();
  });

  it('logs out and redirects when loading returns 401', async () => {
    getStaffAppointment.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
      }),
    );

    renderPage();

    expect(await screen.findByText('Login marker')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
