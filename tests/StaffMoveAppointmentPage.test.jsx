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

const doctor = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. N. Silva',
  specialization: 'Ophthalmologist',
};

const targetDoctor = {
  id: '507f1f77bcf86cd799439055',
  name: 'Dr. P. Perera',
  specialization: 'Eye Surgeon',
};

const branchId = '507f1f77bcf86cd799439012';

function futureIso(days, hours = 0) {
  return new Date(
    Date.now() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000,
  ).toISOString();
}

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
  sessionId: sourceSessionId,
  branchId,
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
  doctorId: doctor.id,
  doctor: {
    id: doctor.id,
    name: doctor.name,
    specialization: doctor.specialization,
  },
  doctorName: doctor.name,
  specialization: doctor.specialization,
  branchId,
  startAt: appointment.dateTime,
  endAt: futureIso(3, 1),
  capacity: 10,
  confirmedCount: 3,
  remainingCapacity: 7,
};

const targetSession = {
  id: targetSessionId,
  doctorId: targetDoctor.id,
  doctor: {
    id: targetDoctor.id,
    name: targetDoctor.name,
    specialization: targetDoctor.specialization,
  },
  doctorName: targetDoctor.name,
  specialization: targetDoctor.specialization,
  branchId,
  startAt: futureIso(7),
  endAt: futureIso(7, 1),
  capacity: 8,
  confirmedCount: 3,
  remainingCapacity: 5,
};

const reassignedAppointment = {
  ...appointment,
  doctorId: targetDoctor.id,
  doctor: {
    id: targetDoctor.id,
    name: targetDoctor.name,
    specialization: targetDoctor.specialization,
  },
  doctorName: targetDoctor.name,
  specialization: targetDoctor.specialization,
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
  await screen.findByText(targetDoctor.name);

  fireEvent.click(screen.getByRole('radio'));
}

async function openConfirmation() {
  await selectTargetSession();

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Review Move',
    }),
  );

  return screen.getByRole('dialog', {
    name: 'Confirm Booking Move',
  });
}

describe('StaffMoveAppointmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    getStaffAppointment.mockResolvedValue(appointment);

    getDoctorSessions.mockResolvedValue([sourceSession, targetSession]);

    getAppointmentProviders.mockResolvedValue([doctor, targetDoctor]);

    reassignStaffAppointment.mockResolvedValue({
      success: true,
    });
  });

  it('shows eligible target doctor sessions and excludes the current session', async () => {
    renderPage();

    expect(await screen.findByText(targetDoctor.name)).toBeInTheDocument();

    expect(screen.getByText(targetDoctor.specialization)).toBeInTheDocument();

    expect(screen.getByText('5')).toBeInTheDocument();

    const targetSessionOptions = screen.getAllByRole('radio');

    expect(targetSessionOptions).toHaveLength(1);

    expect(targetSessionOptions[0]).toHaveAttribute('value', targetSession.id);

    expect(targetSessionOptions[0]).not.toHaveAttribute(
      'value',
      sourceSession.id,
    );

    expect(screen.getByText('Current Doctor')).toBeInTheDocument();

    expect(screen.getByText(doctor.name)).toBeInTheDocument();
  });

  it('requires a target session before confirmation', async () => {
    renderPage();

    await screen.findByText(targetDoctor.name);

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

    const dialog = await openConfirmation();

    expect(dialog).toBeInTheDocument();

    expect(reassignStaffAppointment).not.toHaveBeenCalled();
  });

  it('moves focus into the confirmation dialog when it opens', async () => {
    renderPage();

    await openConfirmation();

    const keepButton = screen.getByRole('button', {
      name: 'Keep Current Booking',
    });

    expect(keepButton).toHaveFocus();
  });

  it('traps keyboard focus inside the confirmation dialog', async () => {
    renderPage();

    await openConfirmation();

    const keepButton = screen.getByRole('button', {
      name: 'Keep Current Booking',
    });

    const confirmButton = screen.getByRole('button', {
      name: 'Confirm Move',
    });

    confirmButton.focus();

    fireEvent.keyDown(document, {
      key: 'Tab',
    });

    expect(keepButton).toHaveFocus();

    keepButton.focus();

    fireEvent.keyDown(document, {
      key: 'Tab',
      shiftKey: true,
    });

    expect(confirmButton).toHaveFocus();
  });

  it('closes the confirmation dialog with Escape and restores trigger focus', async () => {
    renderPage();

    await openConfirmation();

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: 'Confirm Booking Move',
        }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', {
        name: 'Review Move',
      }),
    ).toHaveFocus();
  });

  it('reassigns using only the selected session id and reloads authoritative appointment data', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce(reassignedAppointment);

    renderPage();

    await openConfirmation();

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

  it('keeps a successful move successful when the follow-up refresh fails', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockRejectedValueOnce(
        Object.assign(new Error('Refresh failed'), {
          status: 0,
        }),
      );

    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Move',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Booking moved successfully',
      }),
    ).toBeInTheDocument();

    expect(reassignStaffAppointment).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('status')).toHaveTextContent(
      'latest appointment details could not be loaded',
    );

    expect(
      screen.getByRole('button', {
        name: 'Refresh Appointment',
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText('Cannot move booking')).not.toBeInTheDocument();
  });

  it('retries appointment refresh after a successful move without repeating the move', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockRejectedValueOnce(
        Object.assign(new Error('Refresh failed'), {
          status: 0,
        }),
      )
      .mockResolvedValueOnce(reassignedAppointment);

    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Move',
      }),
    );

    const refreshButton = await screen.findByRole('button', {
      name: 'Refresh Appointment',
    });

    fireEvent.click(refreshButton);

    expect(
      await screen.findByText('Appointment details marker'),
    ).toBeInTheDocument();

    expect(reassignStaffAppointment).toHaveBeenCalledTimes(1);

    expect(getStaffAppointment).toHaveBeenCalledTimes(3);
  });

  it('shows full-session conflicts safely', async () => {
    reassignStaffAppointment.mockRejectedValue(
      Object.assign(new Error('Internal capacity detail'), {
        status: 409,
        code: 'SESSION_FULL',
      }),
    );

    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Move',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'selected doctor session is full',
    );

    expect(
      screen.queryByText('Internal capacity detail'),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['BOOKING_WINDOW', 'at least 24 hours away'],
    ['DUPLICATE_BOOKING', 'already has a confirmed booking'],
    ['SAME_SESSION', 'already assigned to that doctor session'],
    ['SESSION_CHANGED', 'booking changed while it was being moved'],
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

      await openConfirmation();

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

    await openConfirmation();

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

  it('does not close the confirmation dialog with Escape while move submission is pending', async () => {
    reassignStaffAppointment.mockImplementation(() => new Promise(() => {}));

    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Move',
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'Moving Booking...',
      }),
    ).toBeDisabled();

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    expect(
      screen.getByRole('dialog', {
        name: 'Confirm Booking Move',
      }),
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
