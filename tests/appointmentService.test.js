import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  cancelAppointment,
  createAppointment,
  getAppointment,
  getAppointmentProviders,
  getAvailableDoctorSessions,
  getCustomerAppointments,
} from '../src/services/appointmentService';

vi.mock('../src/services/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const provider = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. Perera',
  role: 'OPTOMETRIST',
  branchId: '507f1f77bcf86cd799439012',
};

const doctorSession = {
  id: '507f1f77bcf86cd799439021',
  staffId: provider.id,
  branchId: provider.branchId,
  startAt: '2026-11-01T09:00:00.000Z',
  endAt: '2026-11-01T10:00:00.000Z',
  capacity: 8,
  confirmedCount: 3,
  remainingCapacity: 5,
};

const appointment = {
  id: '507f1f77bcf86cd799439031',
  staffId: provider.id,
  providerName: provider.name,
  sessionId: doctorSession.id,
  branchId: provider.branchId,
  dateTime: doctorSession.startAt,
  status: 'CONFIRMED',
  position: 4,
  createdAt: '2026-10-14T06:30:00.000Z',
  updatedAt: '2026-10-14T06:30:00.000Z',
};

describe('appointmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves eligible Optometrists through the shared API client', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: [provider],
    });

    await expect(getAppointmentProviders()).resolves.toEqual([provider]);

    expect(apiClient.get).toHaveBeenCalledWith('/appointments/providers', {
      authenticated: true,
    });
  });

  it('retrieves backend-authoritative available doctor sessions', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: [doctorSession],
    });

    await expect(getAvailableDoctorSessions()).resolves.toEqual([
      doctorSession,
    ]);

    expect(apiClient.get).toHaveBeenCalledWith('/doctor-sessions/available', {
      authenticated: true,
    });
  });

  it('creates an appointment using only the selected sessionId', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: appointment,
    });

    await expect(createAppointment(doctorSession.id)).resolves.toEqual(
      appointment,
    );

    expect(apiClient.post).toHaveBeenCalledWith(
      '/appointments',
      {
        sessionId: doctorSession.id,
      },
      {
        authenticated: true,
      },
    );
  });

  it('does not submit customer identity, status, provider, position or time when booking', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: appointment,
    });

    await createAppointment(doctorSession.id);

    const requestBody = apiClient.post.mock.calls[0][1];

    expect(requestBody).toEqual({
      sessionId: doctorSession.id,
    });

    expect(requestBody).not.toHaveProperty('customerId');
    expect(requestBody).not.toHaveProperty('staffId');
    expect(requestBody).not.toHaveProperty('status');
    expect(requestBody).not.toHaveProperty('position');
    expect(requestBody).not.toHaveProperty('dateTime');
  });

  it('retrieves only the authenticated customer appointment list endpoint', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: [appointment],
    });

    await expect(getCustomerAppointments()).resolves.toEqual([appointment]);

    expect(apiClient.get).toHaveBeenCalledWith('/appointments', {
      authenticated: true,
    });
  });

  it('retrieves a single appointment by its identifier', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: appointment,
    });

    await expect(getAppointment(appointment.id)).resolves.toEqual(appointment);

    expect(apiClient.get).toHaveBeenCalledWith(
      `/appointments/${appointment.id}`,
      {
        authenticated: true,
      },
    );
  });

  it('cancels an appointment without sending a request body', async () => {
    apiClient.patch.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
      },
    });

    await expect(cancelAppointment(appointment.id)).resolves.toBe(true);

    expect(apiClient.patch).toHaveBeenCalledWith(
      `/appointments/${appointment.id}/cancel`,
      undefined,
      {
        authenticated: true,
      },
    );
  });

  it('rejects a malformed provider response instead of trusting unsafe data', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: [
        {
          ...provider,
          role: 'BRANCH_MANAGER',
        },
      ],
    });

    await expect(getAppointmentProviders()).rejects.toThrow(
      'Invalid appointment response received from the server.',
    );
  });

  it('rejects booking when no doctor session has been selected', async () => {
    await expect(createAppointment('')).rejects.toThrow(
      'A valid doctor session is required.',
    );

    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
