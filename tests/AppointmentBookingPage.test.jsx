import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppointmentBookingPage from '../src/pages/AppointmentBookingPage';
import useAuth from '../src/hooks/useAuth';
import profileService from '../src/services/profile/profileService';
import {
  createAppointment,
  getAppointmentProviders,
  getAvailableDoctorSessions,
} from '../src/services/appointmentService';

vi.mock('../src/hooks/useAuth');

vi.mock('../src/services/profile/profileService', () => ({
  default: {
    getProfile: vi.fn(),
  },
}));

vi.mock('../src/services/appointmentService', () => ({
  createAppointment: vi.fn(),
  getAppointmentProviders: vi.fn(),
  getAvailableDoctorSessions: vi.fn(),
}));

const logout = vi.fn();

const profile = {
  name: 'Asanka Weerasekara',
  email: 'asanka@example.com',
  phone: '077 701 2358',
  address: 'Gampaha',
};

const providers = [
  {
    id: '507f1f77bcf86cd799439011',
    name: 'Dr. Ruwan Perera',
    role: 'OPTOMETRIST',
    branchId: '507f1f77bcf86cd799439012',
  },
  {
    id: '507f1f77bcf86cd799439013',
    name: 'Dr. Nirmali Jayawardena',
    role: 'OPTOMETRIST',
    branchId: '507f1f77bcf86cd799439012',
  },
];

const sessions = [
  {
    id: '507f1f77bcf86cd799439021',
    staffId: providers[0].id,
    branchId: providers[0].branchId,
    startAt: '2026-11-01T09:00:00.000Z',
    endAt: '2026-11-01T10:00:00.000Z',
    capacity: 8,
    confirmedCount: 3,
    remainingCapacity: 5,
  },
  {
    id: '507f1f77bcf86cd799439022',
    staffId: providers[0].id,
    branchId: providers[0].branchId,
    startAt: '2026-11-02T09:00:00.000Z',
    endAt: '2026-11-02T10:00:00.000Z',
    capacity: 8,
    confirmedCount: 7,
    remainingCapacity: 1,
  },
  {
    id: '507f1f77bcf86cd799439023',
    staffId: providers[1].id,
    branchId: providers[1].branchId,
    startAt: '2026-11-03T09:00:00.000Z',
    endAt: '2026-11-03T10:00:00.000Z',
    capacity: 6,
    confirmedCount: 2,
    remainingCapacity: 4,
  },
];

const confirmation = {
  id: '507f1f77bcf86cd799439031',
  staffId: providers[0].id,
  providerName: providers[0].name,
  sessionId: sessions[0].id,
  branchId: providers[0].branchId,
  dateTime: sessions[0].startAt,
  status: 'CONFIRMED',
  position: 4,
  createdAt: '2026-10-14T06:30:00.000Z',
  updatedAt: '2026-10-14T06:30:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/appointments/book']}>
      <Routes>
        <Route path="/appointments/book" element={<AppointmentBookingPage />} />

        <Route
          path="/appointments"
          element={<div>Appointments destination</div>}
        />

        <Route path="/profile" element={<div>Profile destination</div>} />

        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function goToDoctorStep(user) {
  await screen.findByDisplayValue(profile.name);

  await user.click(
    screen.getByRole('button', {
      name: /continue/i,
    }),
  );
}

async function selectDoctorAndContinue(user) {
  await goToDoctorStep(user);

  await user.click(
    screen.getByRole('button', {
      name: /dr\. ruwan perera/i,
    }),
  );

  await user.click(
    screen.getByRole('button', {
      name: /continue/i,
    }),
  );
}

async function selectSessionAndContinue(user) {
  await selectDoctorAndContinue(user);

  await user.click(
    screen.getByRole('button', {
      name: '1 November 2026',
    }),
  );

  const sessionRadio = screen.getByRole('radio', {
    name: /2:30/i,
  });

  await user.click(sessionRadio.closest('label'));

  await user.click(
    screen.getByRole('button', {
      name: /continue/i,
    }),
  );
}

describe('AppointmentBookingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    profileService.getProfile.mockResolvedValue(profile);
    getAppointmentProviders.mockResolvedValue(providers);
    getAvailableDoctorSessions.mockResolvedValue(sessions);
    createAppointment.mockResolvedValue(confirmation);
  });

  it('loads authenticated customer details and backend appointment data', async () => {
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading appointment booking...',
    );

    expect(await screen.findByDisplayValue(profile.name)).toBeInTheDocument();

    expect(screen.getByDisplayValue(profile.phone)).toBeInTheDocument();

    expect(screen.getByDisplayValue(profile.email)).toBeInTheDocument();

    expect(
      screen.getByText('Darshana Opticals — Gampaha Main Branch'),
    ).toBeInTheDocument();

    expect(profileService.getProfile).toHaveBeenCalledTimes(1);
    expect(getAppointmentProviders).toHaveBeenCalledTimes(1);
    expect(getAvailableDoctorSessions).toHaveBeenCalledTimes(1);
  });

  it('shows doctors returned by the backend rather than hard-coded Figma doctors', async () => {
    const user = userEvent.setup();

    renderPage();

    await goToDoctorStep(user);

    expect(
      screen.getByRole('button', {
        name: /dr\. ruwan perera/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: /dr\. nirmali jayawardena/i,
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText('Dr. Samantha Fernando')).not.toBeInTheDocument();
  });

  it('shows only backend sessions belonging to the selected doctor', async () => {
    const user = userEvent.setup();

    renderPage();

    await selectDoctorAndContinue(user);

    expect(
      screen.getByRole('heading', {
        name: /pick a date & time/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: '1 November 2026',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: '2 November 2026',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: '3 November 2026',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not invent arbitrary Figma time slots', async () => {
    const user = userEvent.setup();

    renderPage();

    await selectDoctorAndContinue(user);

    await user.click(
      screen.getByRole('button', {
        name: '1 November 2026',
      }),
    );

    expect(screen.getAllByRole('radio')).toHaveLength(1);

    expect(
      screen.getByRole('radio', {
        name: /2:30/i,
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText('09:30 AM')).not.toBeInTheDocument();

    expect(screen.queryByText('10:30 AM')).not.toBeInTheDocument();
  });

  it('shows the customer, provider and selected backend session before confirmation', async () => {
    const user = userEvent.setup();

    renderPage();

    await selectSessionAndContinue(user);

    const reviewHeading = screen.getByRole('heading', {
      name: /review & confirm/i,
    });

    expect(reviewHeading).toBeInTheDocument();

    const reviewSection = reviewHeading.closest('section');

    expect(within(reviewSection).getByText(profile.name)).toBeInTheDocument();

    expect(
      within(reviewSection).getByText(/Dr\. Ruwan Perera — Optometrist/i),
    ).toBeInTheDocument();

    expect(
      within(reviewSection).getByText('1 November 2026'),
    ).toBeInTheDocument();

    expect(
      within(reviewSection).getByText(
        'Darshana Opticals — Gampaha Main Branch',
      ),
    ).toBeInTheDocument();

    expect(
      within(reviewSection).queryByText(/confirmation email/i),
    ).not.toBeInTheDocument();
  });

  it('submits only the selected backend session and displays authoritative confirmation', async () => {
    const user = userEvent.setup();

    renderPage();

    await selectSessionAndContinue(user);

    await user.click(
      screen.getByRole('button', {
        name: /confirm booking/i,
      }),
    );

    await waitFor(() => {
      expect(createAppointment).toHaveBeenCalledWith(sessions[0].id);
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Appointment Booked!',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Confirmed')).toBeInTheDocument();

    expect(screen.getByText('4')).toBeInTheDocument();

    expect(screen.getByText(confirmation.id)).toBeInTheDocument();
  });

  it('prevents repeated booking submission while the original request is pending', async () => {
    const user = userEvent.setup();

    let resolveBooking;

    createAppointment.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBooking = resolve;
      }),
    );

    renderPage();

    await selectSessionAndContinue(user);

    await user.click(
      screen.getByRole('button', {
        name: /confirm booking/i,
      }),
    );

    const pendingButton = screen.getByRole('button', {
      name: /confirming/i,
    });

    expect(pendingButton).toBeDisabled();

    await user.click(pendingButton);

    expect(createAppointment).toHaveBeenCalledTimes(1);

    resolveBooking(confirmation);

    expect(
      await screen.findByRole('heading', {
        name: 'Appointment Booked!',
      }),
    ).toBeInTheDocument();
  });

  it('handles stale session availability using the backend conflict response', async () => {
    const user = userEvent.setup();

    getAvailableDoctorSessions
      .mockResolvedValueOnce(sessions)
      .mockResolvedValueOnce([]);

    createAppointment.mockRejectedValueOnce({
      status: 409,
      code: 'SESSION_FULL',
    });

    renderPage();

    await selectSessionAndContinue(user);

    await user.click(
      screen.getByRole('button', {
        name: /confirm booking/i,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no longer available/i,
    );

    expect(getAvailableDoctorSessions).toHaveBeenCalledTimes(2);

    expect(
      screen.getByRole('heading', {
        name: /pick a date & time/i,
      }),
    ).toBeInTheDocument();
  });

  it('handles the backend 24-hour booking-window rejection and allows reselection', async () => {
    const user = userEvent.setup();

    getAvailableDoctorSessions
      .mockResolvedValueOnce(sessions)
      .mockResolvedValueOnce([]);

    createAppointment.mockRejectedValueOnce({
      status: 409,
      code: 'BOOKING_WINDOW',
    });

    renderPage();

    await selectSessionAndContinue(user);

    await user.click(
      screen.getByRole('button', {
        name: /confirm booking/i,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/24 hours/i);

    expect(getAvailableDoctorSessions).toHaveBeenCalledTimes(2);

    expect(
      screen.getByRole('heading', {
        name: /pick a date & time/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Appointment Booked!',
      }),
    ).not.toBeInTheDocument();
  });

  it('refreshes availability when the selected provider is no longer valid', async () => {
    const user = userEvent.setup();

    getAvailableDoctorSessions
      .mockResolvedValueOnce(sessions)
      .mockResolvedValueOnce([]);

    createAppointment.mockRejectedValueOnce({
      status: 409,
      code: 'PROVIDER_CHANGED',
    });

    renderPage();

    await selectSessionAndContinue(user);

    await user.click(
      screen.getByRole('button', {
        name: /confirm booking/i,
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /doctor is no longer available/i,
    );

    expect(getAvailableDoctorSessions).toHaveBeenCalledTimes(2);

    expect(
      screen.getByRole('heading', {
        name: /pick a date & time/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Appointment Booked!',
      }),
    ).not.toBeInTheDocument();
  });

  it('uses the existing authentication flow when appointment APIs return 401', async () => {
    getAppointmentProviders.mockRejectedValueOnce({
      status: 401,
    });

    renderPage();

    expect(await screen.findByText('Login destination')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
