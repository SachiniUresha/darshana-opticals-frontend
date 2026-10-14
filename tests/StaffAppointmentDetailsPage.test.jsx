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

const appointment = {
  id: '507f1f77bcf86cd799439031',
  staffId: '507f1f77bcf86cd799439011',
  providerName: 'Dr. N. Silva',
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

  it('shows authoritative appointment details to Branch Assistant', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Appointment Details',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Customer A')).toBeInTheDocument();

    expect(screen.getByText('0771234567')).toBeInTheDocument();

    expect(screen.getByText('Dr. N. Silva')).toBeInTheDocument();

    expect(screen.getByText('#2')).toBeInTheDocument();
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
  });

  it('requires confirmation before cancellation', async () => {
    renderPage();

    await screen.findByText('Customer A');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel Booking',
      }),
    );

    expect(
      screen.getByRole('dialog', {
        name: 'Cancel Customer Booking?',
      }),
    ).toBeInTheDocument();

    expect(cancelStaffAppointment).not.toHaveBeenCalled();
  });

  it('cancels then reloads authoritative appointment state', async () => {
    getStaffAppointment
      .mockResolvedValueOnce(appointment)
      .mockResolvedValueOnce(cancelledAppointment);

    renderPage();

    await screen.findByText('Customer A');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel Booking',
      }),
    );

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
      await screen.findByText(
        'Appointment cancelled successfully. The latest backend state is shown below.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Cancelled')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Cancel Booking',
      }),
    ).not.toBeInTheDocument();
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

    await screen.findByText('Customer A');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel Booking',
      }),
    );

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
      await screen.findByText(
        'Appointment cancelled successfully. The latest backend state is shown below.',
      ),
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

    await screen.findByText('Customer A');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel Booking',
      }),
    );

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
  });

  it('can dismiss the cancellation modal without mutation', async () => {
    renderPage();

    await screen.findByText('Customer A');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel Booking',
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Keep Appointment',
      }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(cancelStaffAppointment).not.toHaveBeenCalled();
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
