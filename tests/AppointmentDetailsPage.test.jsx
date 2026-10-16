import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppointmentDetailsPage from '../src/pages/AppointmentDetailsPage';
import useAuth from '../src/hooks/useAuth';
import {
  cancelAppointment,
  getAppointment,
} from '../src/services/appointmentService';

vi.mock('../src/hooks/useAuth');

vi.mock('../src/services/appointmentService', () => ({
  cancelAppointment: vi.fn(),
  getAppointment: vi.fn(),
}));

const logout = vi.fn();

const doctor = {
  id: 'doctor-1',
  name: 'Dr. Ruwan Perera',
  specialization: 'Ophthalmologist',
};

const futureAppointment = {
  id: 'appointment-1',
  doctorId: doctor.id,
  doctor,
  doctorName: doctor.name,
  specialization: doctor.specialization,
  sessionId: 'session-1',
  branchId: 'branch-1',
  dateTime: '2030-11-01T09:00:00.000Z',
  status: 'CONFIRMED',
  position: 3,
  createdAt: '2026-10-14T06:00:00.000Z',
  updatedAt: '2026-10-14T06:00:00.000Z',
};

const cancelledAppointment = {
  ...futureAppointment,
  status: 'CANCELLED',
  position: null,
  updatedAt: '2026-10-14T07:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/appointments/appointment-1']}>
      <Routes>
        <Route path="/appointments/:id" element={<AppointmentDetailsPage />} />

        <Route
          path="/appointments"
          element={<div>Appointments destination</div>}
        />

        <Route
          path="/appointments/book"
          element={<div>Booking destination</div>}
        />

        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppointmentDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    getAppointment.mockResolvedValue(futureAppointment);

    cancelAppointment.mockResolvedValue(true);
  });

  it('loads appointment and Doctor details', async () => {
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading appointment details...',
    );

    expect(
      await screen.findByRole('heading', {
        name: doctor.name,
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(doctor.name).length).toBeGreaterThan(0);

    expect(screen.getAllByText(doctor.specialization).length).toBeGreaterThan(
      0,
    );

    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);

    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('appointment-1')).toBeInTheDocument();

    expect(getAppointment).toHaveBeenCalledWith('appointment-1');
  });

  it('allows a future confirmed appointment to enter cancellation confirmation', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('heading', {
      name: doctor.name,
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Cancel Appointment',
      }),
    );

    expect(screen.getByText('Cancel this appointment?')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Yes, Cancel Appointment',
      }),
    ).toBeInTheDocument();

    expect(cancelAppointment).not.toHaveBeenCalled();
  });

  it('cancels the appointment and reloads the latest appointment', async () => {
    const user = userEvent.setup();

    getAppointment
      .mockResolvedValueOnce(futureAppointment)
      .mockResolvedValueOnce(cancelledAppointment);

    renderPage();

    await screen.findByRole('heading', {
      name: doctor.name,
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Cancel Appointment',
      }),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Yes, Cancel Appointment',
      }),
    );

    await waitFor(() => {
      expect(cancelAppointment).toHaveBeenCalledWith('appointment-1');
    });

    expect(
      await screen.findByText(
        'Your appointment has been cancelled successfully.',
      ),
    ).toBeInTheDocument();

    expect(getAppointment).toHaveBeenCalledTimes(2);

    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);

    expect(
      screen.getByRole('link', {
        name: 'Book Another Appointment',
      }),
    ).toHaveAttribute('href', '/appointments/book');
  });

  it('prevents repeated cancellation while the request is pending', async () => {
    const user = userEvent.setup();

    let resolveCancellation;

    cancelAppointment.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCancellation = resolve;
      }),
    );

    renderPage();

    await screen.findByRole('heading', {
      name: doctor.name,
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Cancel Appointment',
      }),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Yes, Cancel Appointment',
      }),
    );

    const pendingButton = screen.getByRole('button', {
      name: 'Cancelling...',
    });

    expect(pendingButton).toBeDisabled();

    await user.click(pendingButton);

    expect(cancelAppointment).toHaveBeenCalledTimes(1);

    resolveCancellation(true);

    await waitFor(() => {
      expect(getAppointment).toHaveBeenCalledTimes(2);
    });
  });

  it('shows cancellation-window conflicts safely', async () => {
    const user = userEvent.setup();

    cancelAppointment.mockRejectedValueOnce({
      status: 409,
      code: 'CUSTOMER_CANCEL_WINDOW',
    });

    renderPage();

    await screen.findByRole('heading', {
      name: doctor.name,
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Cancel Appointment',
      }),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Yes, Cancel Appointment',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already started/i,
    );
  });

  it('does not offer cancellation for an already cancelled appointment', async () => {
    getAppointment.mockResolvedValueOnce(cancelledAppointment);

    renderPage();

    expect(
      await screen.findByText('Cancelled', {
        selector: '.appointment-status--cancelled',
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByText(doctor.name).length).toBeGreaterThan(0);

    expect(
      screen.queryByRole('button', {
        name: 'Cancel Appointment',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Book Another Appointment',
      }),
    ).toHaveAttribute('href', '/appointments/book');
  });

  it('handles inaccessible appointment details safely', async () => {
    getAppointment.mockRejectedValueOnce({
      status: 404,
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unavailable or you do not have access/i,
    );
  });

  it('logs out and redirects after an appointment API 401', async () => {
    getAppointment.mockRejectedValueOnce({
      status: 401,
    });

    renderPage();

    expect(await screen.findByText('Login destination')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
