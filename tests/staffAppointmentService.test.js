import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  cancelStaffAppointment,
  createDoctorSession,
  getAppointmentProviders,
  getDoctorSessions,
  getStaffAppointment,
  getStaffAppointments,
  reassignStaffAppointment,
  updateDoctorSession,
} from '../src/services/staffAppointmentService';

vi.mock('../src/services/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const provider = {
  id: '507f1f77bcf86cd799439011',
  name: 'Dr. Silva',
  specialization: 'Ophthalmologist',
};

const branchId = '507f1f77bcf86cd799439012';

const session = {
  id: '507f1f77bcf86cd799439021',
  doctorId: provider.id,
  staffId: null,
  doctor: provider,
  doctorName: provider.name,
  specialization: provider.specialization,
  branchId,
  startAt: '2026-11-01T03:30:00.000Z',
  endAt: '2026-11-01T04:30:00.000Z',
  capacity: 10,
  confirmedCount: 3,
  remainingCapacity: 7,
};

const appointment = {
  id: '507f1f77bcf86cd799439031',
  staffId: provider.id,
  providerName: provider.name,
  sessionId: session.id,
  branchId: branchId,
  dateTime: session.startAt,
  status: 'CONFIRMED',
  position: 2,
  customer: {
    id: '507f1f77bcf86cd799439041',
    name: 'Kamal Perera',
    phone: '0771234567',
  },
};

describe('staffAppointmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves eligible appointment providers through the shared API client', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: [provider],
    });

    await expect(getAppointmentProviders()).resolves.toEqual([provider]);

    expect(apiClient.get).toHaveBeenCalledWith('/appointments/providers');
  });

  it('rejects an invalid appointment providers response', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: {},
    });

    await expect(getAppointmentProviders()).rejects.toThrow(
      'Invalid appointment providers response',
    );
  });

  it('retrieves staff-visible doctor sessions', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: [session],
    });

    await expect(getDoctorSessions()).resolves.toEqual([session]);

    expect(apiClient.get).toHaveBeenCalledWith('/doctor-sessions');
  });

  it('creates a doctor session using the documented payload', async () => {
    const payload = {
      doctorId: provider.id,
      startAt: session.startAt,
      endAt: session.endAt,
      capacity: session.capacity,
    };

    apiClient.post.mockResolvedValue({
      success: true,
      data: session,
    });

    await expect(createDoctorSession(payload)).resolves.toEqual(session);

    expect(apiClient.post).toHaveBeenCalledWith('/doctor-sessions', payload);
  });

  it('updates a doctor session and safely encodes its identifier', async () => {
    const updates = {
      capacity: 12,
    };

    apiClient.patch.mockResolvedValue({
      success: true,
      data: {
        ...session,
        capacity: 12,
      },
    });

    await updateDoctorSession('session/123', updates);

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/doctor-sessions/session%2F123',
      updates,
    );
  });

  it('retrieves staff-visible appointments', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: [appointment],
    });

    await expect(getStaffAppointments()).resolves.toEqual([appointment]);

    expect(apiClient.get).toHaveBeenCalledWith('/appointments');
  });

  it('retrieves one staff appointment and safely encodes its identifier', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: appointment,
    });

    await expect(getStaffAppointment('appointment/123')).resolves.toEqual(
      appointment,
    );

    expect(apiClient.get).toHaveBeenCalledWith(
      '/appointments/appointment%2F123',
    );
  });

  it('cancels an appointment without sending a request body', async () => {
    apiClient.patch.mockResolvedValue({
      success: true,
      data: {
        success: true,
      },
    });

    await expect(cancelStaffAppointment(appointment.id)).resolves.toEqual({
      success: true,
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      `/appointments/${appointment.id}/cancel`,
    );
  });

  it('rejects an invalid appointment cancellation response', async () => {
    apiClient.patch.mockResolvedValue({
      success: true,
      data: {
        success: false,
      },
    });

    await expect(cancelStaffAppointment(appointment.id)).rejects.toThrow(
      'Invalid appointment cancellation response',
    );
  });

  it('reassigns an appointment using only the target sessionId', async () => {
    const targetSessionId = '507f1f77bcf86cd799439099';

    apiClient.patch.mockResolvedValue({
      success: true,
      data: {
        success: true,
      },
    });

    await expect(
      reassignStaffAppointment(appointment.id, targetSessionId),
    ).resolves.toEqual({
      success: true,
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      `/appointments/${appointment.id}/reassign`,
      {
        sessionId: targetSessionId,
      },
    );
  });

  it('rejects an invalid appointment reassignment response', async () => {
    apiClient.patch.mockResolvedValue({
      success: true,
      data: null,
    });

    await expect(
      reassignStaffAppointment(appointment.id, '507f1f77bcf86cd799439099'),
    ).rejects.toThrow('Invalid appointment reassignment response');
  });

  it('propagates backend authorization errors unchanged', async () => {
    const error = Object.assign(new Error('Forbidden'), {
      status: 403,
    });

    apiClient.get.mockRejectedValue(error);

    await expect(getStaffAppointments()).rejects.toBe(error);
  });
});
