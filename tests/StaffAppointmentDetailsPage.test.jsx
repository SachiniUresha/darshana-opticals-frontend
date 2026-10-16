import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffAppointmentDetailsPage from '../src/pages/StaffAppointmentDetailsPage';
import useAuth from '../src/hooks/useAuth';
import {
  cancelStaffAppointment,
  getStaffAppointment,
} from '../src/services/staffAppointmentService';
import { BRANCH_ASSISTANT, BRANCH_MANAGER } from '../src/config/roles';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/staffAppointmentService', () => ({
  cancelStaffAppointment: vi.fn(),
  getStaffAppointment: vi.fn(),
}));

const logout = vi.fn();

const doctor = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. N. Silva',
  specialization: 'Ophthalmologist',
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
  sessionId: '507f1f77bcf86cd799439021',
  branchId: '507f1f77bcf86cd799439012',
  dateTime: '2026-10-20T07:30:00.000Z',
  status: 'CONFIRMED',
  position: 2,
  customer: {
    id: '507f1f77bcf86cd799439041',
    name: 'Customer A',
    phone: '0771234567',
  },
};

const cancelledAppointment = {
  ...appointment,
  status: 'CANCELLED',
  position: null,
};

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={[`/staff/appointments/bookings/${appointment.id}`]}
    >
      <Routes>
        <Route
          path="/staff/appointments/bookings/:appointmentId"
          element={<StaffAppointmentDetailsPage />}
        />

        <Route path="/login" element={<div>Login marker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openCancellationDialog() {
  await screen.findByText('Customer A');

  fireEvent.click(
    screen.getByRole('button', {
      name: 'Cancel Booking',
    }),
  );

  return screen.getByRole('dialog', {
    name: 'Cancel Customer Booking?',
  });
}

describe('StaffAppointmentDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: {
        role: BRANCH_ASSISTANT,
      },
      logout,
    });

    getStaffAppointment.mockResolvedValue(appointment);

    cancelStaffAppointment.mockResolvedValue({
      success: true,
    });
  });

  it('shows authoritative appointment and doctor details to Branch Assistant', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Appointment Details',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Customer A')).toBeInTheDocument();

    expect(screen.getByText('0771234567')).toBeInTheDocument();

    expect(screen.getByText('Doctor & Session')).toBeInTheDocument();

    expect(screen.getByText(doctor.name)).toBeInTheDocument();

    expect(screen.getByText(doctor.specialization)).toBeInTheDocument();

    expect(screen.getByText('#2')).toBeInTheDocument();

    expect(screen.queryByText('Optometrist & Session')).not.toBeInTheDocument();
  });

  it('keeps Branch Manager read-only and hides customer contact', async () => {
    useAuth.mockReturnValue({
      user: {
        role: BRANCH_MANAGER,
      },
      logout,
    });

    renderPage();

    expect(
      await screen.findByText('Customer contact restricted'),
    ).toBeInTheDocument();

    expect(screen.queryByText('Customer A')).not.toBeInTheDocument();

    expect(screen.queryByText('0771234567')).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Cancel Booking',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Move Booking',
      }),
    ).not.toBeInTheDocument();

    expect(screen.getByText(doctor.name)).toBeInTheDocument();
  });

  it('does not show mutation controls for an already cancelled appointment', async () => {
    getStaffAppointment.mockResolvedValue(cancelledAppointment);

    renderPage();

    expect(await screen.findByText('Cancelled')).toBeInTheDocument();

    expect(screen.getByText('Not applicable')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Cancel Booking',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Move Booking',
      }),
    ).not.toBeInTheDocument();
  });

  it('requires confirmation before cancellation', async () => {
    renderPage();

    const dialog = await openCancellationDialog();

    expect(dialog).toBeInTheDocument();

    expect(cancelStaffAppointment).not.toHaveBeenCalled();
  });

  it('moves focus into the cancellation dialog when it opens', async () => {
    renderPage();

    await openCancellationDialog();

    expect(
      screen.getByRole('button', {
        name: 'Keep Appointment',
      }),
    ).toHaveFocus();
  });

  it('traps keyboard focus inside the cancellation dialog', async () => {
    renderPage();

    await openCancellationDialog();

    const keepButton = screen.getByRole('button', {
      name: 'Keep Appointment',
    });

    const confirmButton = screen.getByRole('button', {
      name: 'Confirm Cancellation',
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

  it('closes the cancellation dialog with Escape and restores focus', async () => {
    renderPage();

    await openCancellationDialog();

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', {
          name: 'Cancel Customer Booking?',
        }),
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', {
        name: 'Cancel Booking',
      }),
    ).toHaveFocus();

    expect(cancelStaffAppointment).not.toHaveBeenCalled();
  });

  it('can dismiss the cancellation modal without mutation and restores focus', async () => {
    renderPage();

    await openCancellationDialog();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Keep Appointment',
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(cancelStaffAppointment).not.toHaveBeenCalled();

    expect(
      screen.getByRole('button', {
        name: 'Cancel Booking',
      }),
    ).toHaveFocus();
  });

  it('cancels then reloads authoritative appointment state', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce(cancelledAppointment);

    renderPage();

    await openCancellationDialog();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Cancellation',
      }),
    );

    await waitFor(() => {
      expect(cancelStaffAppointment).toHaveBeenCalledWith(appointment.id);
    });

    expect(getStaffAppointment).toHaveBeenCalledTimes(2);

    expect(
      await screen.findByText('Appointment cancelled successfully.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Cancelled')).toBeInTheDocument();

    expect(screen.getByText('Not applicable')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Cancel Booking',
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps a successful cancellation successful when refresh fails', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockRejectedValueOnce(
        Object.assign(new Error('Refresh failed'), {
          status: 0,
        }),
      );

    renderPage();

    await openCancellationDialog();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Cancellation',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Appointment cancelled successfully',
      }),
    ).toBeInTheDocument();

    expect(cancelStaffAppointment).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('status')).toHaveTextContent(
      'latest appointment details could not be loaded',
    );

    expect(
      screen.getByRole('button', {
        name: 'Refresh Appointment',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Unable to cancel the appointment'),
    ).not.toBeInTheDocument();
  });

  it('retries refresh after cancellation without cancelling again', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockRejectedValueOnce(
        Object.assign(new Error('Refresh failed'), {
          status: 0,
        }),
      )
      .mockResolvedValueOnce(cancelledAppointment);

    renderPage();

    await openCancellationDialog();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Cancellation',
      }),
    );

    const refreshButton = await screen.findByRole('button', {
      name: 'Refresh Appointment',
    });

    fireEvent.click(refreshButton);

    expect(
      await screen.findByText('Appointment cancelled successfully.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Cancelled')).toBeInTheDocument();

    expect(cancelStaffAppointment).toHaveBeenCalledTimes(1);

    expect(getStaffAppointment).toHaveBeenCalledTimes(3);
  });

  it('prevents duplicate cancellation while request is pending', async () => {
    let resolveCancel;

    cancelStaffAppointment.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCancel = resolve;
        }),
    );

    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce(cancelledAppointment);

    renderPage();

    await openCancellationDialog();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Cancellation',
      }),
    );

    const pendingButton = await screen.findByRole('button', {
      name: 'Cancelling...',
    });

    expect(pendingButton).toBeDisabled();

    fireEvent.click(pendingButton);

    expect(cancelStaffAppointment).toHaveBeenCalledTimes(1);

    resolveCancel({
      success: true,
    });

    expect(
      await screen.findByText('Appointment cancelled successfully.'),
    ).toBeInTheDocument();

    expect(cancelStaffAppointment).toHaveBeenCalledTimes(1);
  });

  it('does not close the cancellation dialog with Escape while pending', async () => {
    cancelStaffAppointment.mockImplementation(() => new Promise(() => {}));

    renderPage();

    await openCancellationDialog();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Cancellation',
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'Cancelling...',
      }),
    ).toBeDisabled();

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    expect(
      screen.getByRole('dialog', {
        name: 'Cancel Customer Booking?',
      }),
    ).toBeInTheDocument();
  });

  it('shows invalid-status cancellation conflicts safely', async () => {
    cancelStaffAppointment.mockRejectedValue(
      Object.assign(new Error('Internal status detail'), {
        status: 409,
        code: 'INVALID_STATUS',
      }),
    );

    renderPage();

    await openCancellationDialog();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm Cancellation',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only confirmed appointments can be cancelled.',
    );

    expect(
      screen.queryByText('Internal status detail'),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText('Appointment cancelled successfully.'),
    ).not.toBeInTheDocument();
  });

  it('logs out and redirects when appointment loading returns 401', async () => {
    getStaffAppointment.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
      }),
    );

    renderPage();

    expect(await screen.findByText('Login marker')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows a safe access error without leaking backend details', async () => {
    getStaffAppointment.mockRejectedValue(
      Object.assign(new Error('Sensitive authorization detail'), {
        status: 403,
      }),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to view this appointment.',
    );

    expect(
      screen.queryByText('Sensitive authorization detail'),
    ).not.toBeInTheDocument();
  });
});
