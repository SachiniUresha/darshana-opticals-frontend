import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffCreateDoctorSessionPage from '../src/pages/StaffCreateDoctorSessionPage';
import useAuth from '../src/hooks/useAuth';
import {
  createDoctorSession,
  getAppointmentProviders,
} from '../src/services/staffAppointmentService';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/staffAppointmentService', () => ({
  createDoctorSession: vi.fn(),
  getAppointmentProviders: vi.fn(),
}));

const logout = vi.fn();

const doctor = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. N. Silva',
  specialization: 'Ophthalmologist',
};

const branchId = '507f1f77bcf86cd799439012';

const createdSession = {
  id: '507f1f77bcf86cd799439021',
  doctorId: doctor.id,
  staffId: null,
  doctor,
  doctorName: doctor.name,
  specialization: doctor.specialization,
  branchId,
  startAt: '2026-10-20T07:30:00.000Z',
  endAt: '2026-10-20T08:30:00.000Z',
  capacity: 10,
  confirmedCount: 0,
  remainingCapacity: 10,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/appointments/sessions/new']}>
      <Routes>
        <Route
          path="/staff/appointments/sessions/new"
          element={<StaffCreateDoctorSessionPage />}
        />

        <Route
          path="/staff/appointments/sessions/:id"
          element={<div>Session details marker</div>}
        />

        <Route path="/login" element={<div>Login marker</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidForm() {
  await screen.findByRole('option', {
    name: 'Dr. N. Silva — Ophthalmologist',
  });

  fireEvent.change(screen.getByLabelText('Date *'), {
    target: {
      value: '2026-10-20',
    },
  });

  fireEvent.change(screen.getByLabelText('Start Time *'), {
    target: {
      value: '13:00',
    },
  });

  fireEvent.change(screen.getByLabelText('End Time *'), {
    target: {
      value: '14:00',
    },
  });
}

describe('StaffCreateDoctorSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      logout,
    });

    getAppointmentProviders.mockResolvedValue([doctor]);
    createDoctorSession.mockResolvedValue(createdSession);
  });

  it('loads Doctors and specialization from the appointment API', async () => {
    renderPage();

    expect(
      await screen.findByRole('option', {
        name: 'Dr. N. Silva — Ophthalmologist',
      }),
    ).toBeInTheDocument();

    expect(getAppointmentProviders).toHaveBeenCalledTimes(1);

    expect(
      screen.getByDisplayValue('Gampaha Main Branch · fixed'),
    ).toHaveAttribute('readonly');
  });

  it('creates a Doctor session using doctorId and session details only', async () => {
    renderPage();

    await fillValidForm();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Create Session',
      }),
    );

    await waitFor(() => {
      expect(createDoctorSession).toHaveBeenCalledWith({
        doctorId: doctor.id,
        startAt: '2026-10-20T13:00:00+05:30',
        endAt: '2026-10-20T14:00:00+05:30',
        capacity: 10,
      });
    });

    const submittedPayload = createDoctorSession.mock.calls[0][0];

    expect(submittedPayload).not.toHaveProperty('staffId');
    expect(submittedPayload).not.toHaveProperty('branchId');

    expect(
      await screen.findByText('Session details marker'),
    ).toBeInTheDocument();
  });

  it('rejects an end time that is not later than the start time', async () => {
    renderPage();

    await screen.findByRole('option', {
      name: 'Dr. N. Silva — Ophthalmologist',
    });

    fireEvent.change(screen.getByLabelText('Date *'), {
      target: {
        value: '2026-10-20',
      },
    });

    fireEvent.change(screen.getByLabelText('Start Time *'), {
      target: {
        value: '13:00',
      },
    });

    fireEvent.change(screen.getByLabelText('End Time *'), {
      target: {
        value: '12:00',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Create Session',
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'End time must be later than the start time.',
    );

    expect(createDoctorSession).not.toHaveBeenCalled();
  });

  it('rejects an invalid capacity before submitting', async () => {
    renderPage();

    await fillValidForm();

    fireEvent.change(screen.getByLabelText('Capacity *'), {
      target: {
        value: '0',
      },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Create Session',
      }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Capacity must be a positive whole number.',
    );

    expect(createDoctorSession).not.toHaveBeenCalled();
  });

  it('shows Doctor overlap conflicts without claiming success', async () => {
    createDoctorSession.mockRejectedValue(
      Object.assign(new Error('Overlap'), {
        status: 409,
        code: 'OVERLAPPING_SESSION',
      }),
    );

    renderPage();

    await fillValidForm();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Create Session',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot create session',
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Doctor already has a session that overlaps',
    );

    expect(
      screen.queryByText('Session details marker'),
    ).not.toBeInTheDocument();
  });

  it('shows unavailable Doctor errors safely', async () => {
    createDoctorSession.mockRejectedValue(
      Object.assign(new Error('Doctor missing'), {
        status: 404,
      }),
    );

    renderPage();

    await fillValidForm();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Create Session',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'selected Doctor is no longer available',
    );
  });

  it('prevents duplicate submission while creation is pending', async () => {
    let resolveCreate;

    createDoctorSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderPage();

    await fillValidForm();

    const submitButton = screen.getByRole('button', {
      name: 'Create Session',
    });

    fireEvent.click(submitButton);

    expect(
      await screen.findByRole('button', {
        name: 'Creating Session...',
      }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Creating Session...',
      }),
    );

    expect(createDoctorSession).toHaveBeenCalledTimes(1);

    resolveCreate(createdSession);

    expect(
      await screen.findByText('Session details marker'),
    ).toBeInTheDocument();
  });

  it('logs out and redirects when Doctor loading returns 401', async () => {
    getAppointmentProviders.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
      }),
    );

    renderPage();

    expect(await screen.findByText('Login marker')).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows a safe network error when Doctor loading fails', async () => {
    getAppointmentProviders.mockRejectedValue(
      Object.assign(new Error('Network details'), {
        status: 0,
      }),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the server. Please check your connection and try again.',
    );

    expect(screen.queryByText('Network details')).not.toBeInTheDocument();
  });

  it('does not show technical backend implementation messages', async () => {
    renderPage();

    await screen.findByRole('option', {
      name: 'Dr. N. Silva — Ophthalmologist',
    });

    expect(screen.queryByText(/backend validation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server validates/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/checked by the backend/i),
    ).not.toBeInTheDocument();
  });
});
