import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppointmentHistoryPage from '../src/pages/AppointmentHistoryPage';
import useAuth from '../src/hooks/useAuth';
import { getCustomerAppointments } from '../src/services/appointmentService';

vi.mock('../src/hooks/useAuth');

vi.mock('../src/services/appointmentService', () => ({
  getCustomerAppointments: vi.fn(),
}));

const logout = vi.fn();

const appointments = [
  {
    id: 'appointment-1',
    staffId: 'provider-1',
    providerName: 'Dr. Ruwan Perera',
    sessionId: 'session-1',
    branchId: 'branch-1',
    dateTime: '2030-11-01T09:00:00.000Z',
    status: 'CONFIRMED',
    position: 3,
    createdAt: '2026-10-14T06:00:00.000Z',
    updatedAt: '2026-10-14T06:00:00.000Z',
  },
  {
    id: 'appointment-2',
    staffId: 'provider-2',
    providerName: 'Dr. Nirmali Jayawardena',
    sessionId: 'session-2',
    branchId: 'branch-1',
    dateTime: '2020-01-01T09:00:00.000Z',
    status: 'CANCELLED',
    position: null,
    createdAt: '2020-01-01T05:00:00.000Z',
    updatedAt: '2020-01-01T06:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/appointments']}>
      <Routes>
        <Route path="/appointments" element={<AppointmentHistoryPage />} />

        <Route
          path="/appointments/book"
          element={<div>Booking destination</div>}
        />

        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppointmentHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    getCustomerAppointments.mockResolvedValue(appointments);
  });

  it('loads the authenticated customer appointment history', async () => {
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading your appointments...',
    );

    expect(await screen.findByText('Dr. Ruwan Perera')).toBeInTheDocument();

    expect(screen.getByText('Dr. Nirmali Jayawardena')).toBeInTheDocument();

    expect(getCustomerAppointments).toHaveBeenCalledTimes(1);
  });

  it('shows only canonical appointment statuses', async () => {
    renderPage();

    expect(await screen.findByText('Confirmed')).toBeInTheDocument();

    expect(screen.getByText('Cancelled')).toBeInTheDocument();

    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('classifies appointments as upcoming or past without changing backend status', async () => {
    renderPage();

    expect(await screen.findByText('Upcoming')).toBeInTheDocument();

    expect(screen.getByText('Past')).toBeInTheDocument();
  });

  it('shows an empty state with a booking action', async () => {
    getCustomerAppointments.mockResolvedValueOnce([]);

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'No appointments yet',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Book Your Eye Test',
      }),
    ).toHaveAttribute('href', '/appointments/book');
  });

  it('retries after an appointment history loading error', async () => {
    const user = userEvent.setup();

    getCustomerAppointments
      .mockRejectedValueOnce({
        status: 0,
      })
      .mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unable to reach the server/i,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Try Again',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'No appointments yet',
      }),
    ).toBeInTheDocument();

    expect(getCustomerAppointments).toHaveBeenCalledTimes(2);
  });

  it('logs out and redirects when the appointment API returns 401', async () => {
    getCustomerAppointments.mockRejectedValueOnce({
      status: 401,
    });

    renderPage();

    expect(await screen.findByText('Login destination')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
