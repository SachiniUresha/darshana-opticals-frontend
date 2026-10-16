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

const doctor = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. N. Silva',
  specialization: 'Ophthalmologist',
};

const branchId = '507f1f77bcf86cd799439012';

const session = {
  id: '507f1f77bcf86cd799439021',
  doctorId: doctor.id,
  doctor,
  doctorName: doctor.name,
  specialization: doctor.specialization,
  branchId,
  startAt: '2026-10-20T07:30:00.000Z',
  endAt: '2026-10-20T08:30:00.000Z',
  capacity: 10,
  confirmedCount: 2,
  remainingCapacity: 8,
};

const appointment = {
  id: '507f1f77bcf86cd799439031',
  doctorId: doctor.id,
  doctor,
  doctorName: doctor.name,
  specialization: doctor.specialization,
  sessionId: session.id,
  branchId,
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

async function openConfirmation() {
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

  return screen.getByRole('dialog', {
    name: 'Confirm Session Reschedule',
  });
}

describe('StaffEditDoctorSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    getDoctorSessions.mockResolvedValue([session]);
    getAppointmentProviders.mockResolvedValue([doctor]);

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

  it('pre-fills the existing Doctor and specialization', async () => {
    renderPage();

    await waitForForm();

    expect(
      screen.getByDisplayValue('Dr. N. Silva — Ophthalmologist'),
    ).toBeInTheDocument();

    expect(screen.getByDisplayValue('10')).toBeInTheDocument();

    expect(screen.getByText('2 CONFIRMED')).toBeInTheDocument();

    const doctorSelect = screen.getByRole('combobox', {
      name: 'Doctor *',
    });

    expect(doctorSelect).toHaveValue(doctor.id);

    expect(doctorSelect.selectedOptions[0]).toHaveTextContent(
      'Dr. N. Silva — Ophthalmologist',
    );
  });

  it('shows the confirmation modal before saving changes', async () => {
    renderPage();

    const dialog = await openConfirmation();

    expect(dialog).toBeInTheDocument();

    expect(updateDoctorSession).not.toHaveBeenCalled();
  });

  it('moves focus into the confirmation dialog when it opens', async () => {
    renderPage();

    await openConfirmation();

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Keep Current Session',
        }),
      ).toHaveFocus();
    });
  });

  it('traps keyboard focus inside the confirmation dialog', async () => {
    renderPage();

    await openConfirmation();

    const keepButton = screen.getByRole('button', {
      name: 'Keep Current Session',
    });

    const confirmButton = screen.getByRole('button', {
      name: 'Confirm Reschedule',
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

  it('prevents background controls from keeping focus while dialog is open', async () => {
    renderPage();

    await openConfirmation();

    const doctorSelect = screen.getByRole('combobox', {
      name: 'Doctor *',
    });

    doctorSelect.focus();

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Keep Current Session',
        }),
      ).toHaveFocus();
    });
  });

  it('closes the confirmation with Escape and restores trigger focus', async () => {
    renderPage();

    await openConfirmation();

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: 'Confirm Session Reschedule',
        }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    ).toHaveFocus();

    expect(updateDoctorSession).not.toHaveBeenCalled();
  });

  it('saves using doctorId without sending legacy staff or branch identifiers', async () => {
    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    await waitFor(() => {
      expect(updateDoctorSession).toHaveBeenCalledWith(session.id, {
        doctorId: doctor.id,
        startAt: '2026-10-20T13:00:00+05:30',
        endAt: '2026-10-20T14:00:00+05:30',
        capacity: 12,
      });
    });

    const submittedPayload = updateDoctorSession.mock.calls[0][1];

    expect(submittedPayload).not.toHaveProperty('staffId');
    expect(submittedPayload).not.toHaveProperty('branchId');

    expect(
      await screen.findByText('Session details marker'),
    ).toBeInTheDocument();
  });

  it('requires explicit Doctor selection when editing a legacy Optometrist session', async () => {
    getDoctorSessions.mockResolvedValueOnce([
      {
        ...session,
        doctorId: null,
        doctor: null,
        doctorName: null,
        specialization: null,
        staffId: '507f1f77bcf86cd799439099',
      },
    ]);

    renderPage();

    await waitForForm();

    expect(screen.getByDisplayValue('Select a Doctor')).toBeInTheDocument();

    expect(screen.getByText('Legacy Optometrist session')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please select a Doctor.',
    );

    expect(updateDoctorSession).not.toHaveBeenCalled();
  });

  it('converts a legacy session to a Doctor only after explicit selection', async () => {
    getDoctorSessions.mockResolvedValueOnce([
      {
        ...session,
        doctorId: null,
        doctor: null,
        doctorName: null,
        specialization: null,
        staffId: '507f1f77bcf86cd799439099',
      },
    ]);

    renderPage();

    await waitForForm();

    fireEvent.change(screen.getByLabelText('Doctor *'), {
      target: {
        value: doctor.id,
      },
    });

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
          doctorId: doctor.id,
          capacity: 12,
        }),
      );
    });

    expect(updateDoctorSession.mock.calls[0][1]).not.toHaveProperty('staffId');
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

  it('shows Doctor overlap conflicts safely', async () => {
    updateDoctorSession.mockRejectedValue(
      Object.assign(new Error('Overlap details'), {
        status: 409,
        code: 'OVERLAPPING_SESSION',
      }),
    );

    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Doctor already has another session that overlaps',
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

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Capacity cannot be reduced below the number of confirmed active bookings.',
    );
  });

  it('can cancel the confirmation without submitting and restores focus', async () => {
    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Keep Current Session',
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(updateDoctorSession).not.toHaveBeenCalled();

    expect(
      screen.getByRole('button', {
        name: 'Save Session Changes',
      }),
    ).toHaveFocus();
  });

  it('does not close the confirmation with Escape while saving is pending', async () => {
    updateDoctorSession.mockImplementation(() => new Promise(() => {}));

    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'Saving Changes...',
      }),
    ).toBeDisabled();

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    expect(
      screen.getByRole('dialog', {
        name: 'Confirm Session Reschedule',
      }),
    ).toBeInTheDocument();
  });

  it('prevents duplicate update submission while saving is pending', async () => {
    let resolveUpdate;

    updateDoctorSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    renderPage();

    await openConfirmation();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Reschedule',
      }),
    );

    const pendingButton = await screen.findByRole('button', {
      name: 'Saving Changes...',
    });

    expect(pendingButton).toBeDisabled();

    fireEvent.click(pendingButton);

    expect(updateDoctorSession).toHaveBeenCalledTimes(1);

    resolveUpdate({
      ...session,
      capacity: 12,
    });

    expect(
      await screen.findByText('Session details marker'),
    ).toBeInTheDocument();

    expect(updateDoctorSession).toHaveBeenCalledTimes(1);
  });

  it('uses user-friendly staff instructions without backend implementation wording', async () => {
    renderPage();

    await waitForForm();

    expect(screen.queryByText(/approved api/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/backend/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server validates/i)).not.toBeInTheDocument();
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
