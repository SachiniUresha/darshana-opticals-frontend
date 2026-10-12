import { beforeEach, describe, expect, it, vi } from 'vitest';
import prescriptionService from '../src/services/prescription/prescriptionService';
import apiClient from '../src/services/apiClient';

vi.mock('../src/services/apiClient');

describe('prescriptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads all customer prescriptions in backend order', async () => {
    const prescriptions = [
      {
        id: 'prescription-2',
        recordedAt: '2026-10-10T10:00:00.000Z',
        rightEye: {
          distance: { sph: -1.5, cyl: -0.5, axis: 90, va: '6/6' },
          reading: { add: 1.5, nearVa: 'N6' },
        },
      },
      {
        id: 'prescription-1',
        recordedAt: '2026-09-10T10:00:00.000Z',
      },
    ];

    apiClient.get.mockResolvedValue({
      success: true,
      data: prescriptions,
    });

    await expect(prescriptionService.getMyPrescriptions()).resolves.toEqual(
      prescriptions,
    );

    expect(apiClient.get).toHaveBeenCalledWith('/prescriptions/me');
  });

  it('accepts an empty prescription history', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: [],
    });

    await expect(prescriptionService.getMyPrescriptions()).resolves.toEqual([]);
  });

  it('rejects a malformed prescription history response', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: null,
    });

    await expect(prescriptionService.getMyPrescriptions()).rejects.toThrow(
      'Invalid prescription history response.',
    );
  });

  it('searches customers using the approved backend lookup API', async () => {
    const customers = [
      {
        id: '507f1f77bcf86cd799439011',
        name: 'Kamal Perera',
        email: 'kamal@example.com',
        phone: '+94711234567',
      },
    ];

    apiClient.get.mockResolvedValue({
      success: true,
      data: customers,
    });

    await expect(
      prescriptionService.searchCustomers(' Kamal Perera '),
    ).resolves.toEqual(customers);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/customers/lookup?q=Kamal%20Perera',
    );
  });

  it.each(['', 'a', 'a'.repeat(101)])(
    'rejects invalid customer search input',
    async (query) => {
      await expect(prescriptionService.searchCustomers(query)).rejects.toThrow(
        'Search must contain between 2 and 100 characters.',
      );

      expect(apiClient.get).not.toHaveBeenCalled();
    },
  );

  it('rejects a malformed customer lookup response', async () => {
    apiClient.get.mockResolvedValue({
      success: true,
      data: {},
    });

    await expect(prescriptionService.searchCustomers('Kamal')).rejects.toThrow(
      'Invalid customer lookup response.',
    );
  });

  it('loads a selected customer history for an optometrist', async () => {
    const customerId = '507f1f77bcf86cd799439011';
    const prescriptions = [{ id: 'prescription-1' }];

    apiClient.get.mockResolvedValue({
      success: true,
      data: prescriptions,
    });

    await expect(
      prescriptionService.getCustomerPrescriptions(customerId),
    ).resolves.toEqual(prescriptions);

    expect(apiClient.get).toHaveBeenCalledWith(
      `/prescriptions/customer/${customerId}`,
    );
  });

  it('requires a selected customer before loading their history', async () => {
    await expect(
      prescriptionService.getCustomerPrescriptions(''),
    ).rejects.toThrow('A customer must be selected.');

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('creates a prescription using approved fields only', async () => {
    const input = {
      customerId: '507f1f77bcf86cd799439011',
      rightEye: {
        distance: { sph: -1.5, cyl: -0.5, axis: 180, va: '6/6' },
        reading: { add: 1.5, nearVa: 'N6' },
      },
      leftEye: {
        distance: { sph: -2, cyl: -0.75, axis: 0, va: '6/9' },
        reading: { add: 1.25, nearVa: 'N8' },
      },
      remarks: 'Follow-up recommended.',
      recordedBy: 'untrusted-staff-id',
      recordedAt: '2020-01-01',
      isArchived: true,
    };

    const created = {
      id: 'new-prescription-id',
      recordedAt: '2026-10-12T10:00:00.000Z',
      rightEye: input.rightEye,
      leftEye: input.leftEye,
    };

    apiClient.post.mockResolvedValue({
      success: true,
      data: created,
    });

    await expect(
      prescriptionService.createPrescription(input),
    ).resolves.toEqual(created);

    expect(apiClient.post).toHaveBeenCalledWith('/prescriptions', {
      customerId: input.customerId,
      rightEye: input.rightEye,
      leftEye: input.leftEye,
      remarks: input.remarks,
    });
  });

  it('rejects a malformed creation response', async () => {
    apiClient.post.mockResolvedValue({
      success: true,
      data: null,
    });

    await expect(
      prescriptionService.createPrescription({
        customerId: 'customer-1',
      }),
    ).rejects.toThrow('Invalid prescription creation response.');
  });

  it('preserves backend authorization errors', async () => {
    const error = new Error('Access denied.');
    error.status = 403;

    apiClient.get.mockRejectedValue(error);

    await expect(
      prescriptionService.getMyPrescriptions(),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Access denied.',
    });
  });
});
