import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import { createDoctor } from '../src/services/doctorAdminService';

vi.mock('../src/services/apiClient', () => ({
  default: { post: vi.fn() },
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
