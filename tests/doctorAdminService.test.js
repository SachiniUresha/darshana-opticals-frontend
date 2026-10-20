import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  createDoctor,
  listManagedDoctors,
  updateDoctorDetails,
  updateDoctorStatus,
} from '../src/services/doctorAdminService';

vi.mock('../src/services/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
}));

describe('createDoctor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the approved Doctor API and returns only safe fields', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: {
        id: 'doctor-1',
        name: 'Dr. Nimal Perera',
        specialization: 'Ophthalmologist',
        ignored: 'hidden',
      },
    });
    await expect(
      createDoctor({
        name: 'Dr. Nimal Perera',
        specialization: 'Ophthalmologist',
      }),
    ).resolves.toEqual({
      id: 'doctor-1',
      name: 'Dr. Nimal Perera',
      specialization: 'Ophthalmologist',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/doctors', {
      name: 'Dr. Nimal Perera',
      specialization: 'Ophthalmologist',
    });
  });

  it('rejects unconfirmed backend responses', async () => {
    apiClient.post.mockResolvedValue({ success: false, data: {} });
    await expect(
      createDoctor({ name: 'Dr. Test', specialization: 'Eye care' }),
    ).rejects.toThrow(/did not confirm/i);
  });
});

describe('DDP-094 provisional Doctor management API', () => {
  const doctor = {
    id: 'doctor-1',
    name: 'Dr. Nimal Perera',
    specialization: 'Ophthalmologist',
    isActive: true,
  };

  beforeEach(() => vi.clearAllMocks());

  it('lists only safe Doctor fields using the provisional Admin endpoint', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: [{ ...doctor, ignoredSecret: 'never expose' }],
    });
    await expect(listManagedDoctors()).resolves.toEqual([doctor]);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/doctors');
  });

  it('supports a wrapped management array and unknown legacy status', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: { doctors: [{ ...doctor, isActive: undefined }] },
    });
    await expect(listManagedDoctors()).resolves.toEqual([
      { ...doctor, isActive: null },
    ]);
  });

  it('rejects malformed list data instead of reporting an empty directory', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await expect(listManagedDoctors()).rejects.toThrow(
      /Invalid Doctor management list/i,
    );
  });

  it('does not mistake unconfirmed or mismatched edits for success', async () => {
    apiClient.patch.mockResolvedValue({ success: true, data: doctor });
    const fields = { name: doctor.name, specialization: doctor.specialization };
    await expect(updateDoctorDetails(doctor.id, fields)).resolves.toEqual(
      doctor,
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/admin/doctors/doctor-1',
      fields,
    );
    await expect(
      updateDoctorDetails(doctor.id, { ...fields, name: 'Other name' }),
    ).rejects.toThrow(/not confirmed/i);
  });

  it('requires backend-confirmed status and never assumes activation success', async () => {
    apiClient.patch.mockResolvedValue({
      success: true,
      data: { ...doctor, isActive: false },
    });
    await expect(updateDoctorStatus(doctor.id, false)).resolves.toEqual({
      ...doctor,
      isActive: false,
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/admin/doctors/doctor-1/status',
      { isActive: false },
    );
    await expect(updateDoctorStatus(doctor.id, true)).rejects.toThrow(
      /not confirmed/i,
    );
    await expect(updateDoctorStatus(doctor.id, 'true')).rejects.toThrow(
      /Invalid Doctor activation/i,
    );
  });
});

describe('DDP-094 Doctor status and search query contract', () => {
  it('uses the backend filters for both account statuses', async () => {
    const record = {
      id: 'doctor-7',
      name: 'Dr. Saman',
      specialization: 'Optics',
      isActive: false,
    };
    apiClient.get.mockResolvedValue({ success: true, data: [record] });
    await expect(
      listManagedDoctors({ isActive: false, search: '  Saman  ' }),
    ).resolves.toEqual([record]);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/admin/doctors?isActive=false&search=Saman',
    );
  });
});
