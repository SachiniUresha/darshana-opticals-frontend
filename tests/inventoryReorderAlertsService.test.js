import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import { getActiveReorderAlerts } from '../src/services/inventoryService';

vi.mock('../src/services/apiClient', () => ({ default: { get: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

const sample = { alerts: [], total: 0, page: 1, limit: 20 };

describe('reorder alerts API service', () => {
  it('retrieves only backend-reported active alerts for a selected branch', async () => {
    const row = {
      _id: 'alert-1',
      status: 'ACTIVE',
      threshold: 5,
      currentQuantity: 2,
    };
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: { ...sample, alerts: [row], total: 1 },
    });
    await expect(getActiveReorderAlerts('branch-1')).resolves.toEqual({
      ...sample,
      alerts: [row],
      total: 1,
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/inventory/reorder-alerts/branch/branch-1?page=1&limit=20',
    );
  });

  it('uses server pagination rather than truncating an unbounded alert list', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: { ...sample, page: 2, total: 22 },
    });
    await getActiveReorderAlerts('branch-2', 2);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/inventory/reorder-alerts/branch/branch-2?page=2&limit=20',
    );
  });

  it.each(['', null, undefined])(
    'rejects missing branch scope %s without a network request',
    async (id) => {
      await expect(getActiveReorderAlerts(id)).rejects.toThrow(
        'A branch is required',
      );
      expect(apiClient.get).not.toHaveBeenCalled();
    },
  );

  it.each([0, -1, 1.5, '2'])(
    'rejects an invalid pagination input %s',
    async (page) => {
      await expect(getActiveReorderAlerts('branch-1', page)).rejects.toThrow(
        'invalid reorder alert page',
      );
      expect(apiClient.get).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid backend response without inventing alert data', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: { alerts: [], total: '12', page: 1, limit: 20 },
    });
    await expect(getActiveReorderAlerts('branch-1')).rejects.toThrow(
      'Invalid reorder alerts response',
    );
  });

  it('propagates backend 403 so the view displays safe access-denied feedback', async () => {
    const error = Object.assign(new Error('server secrets'), { status: 403 });
    apiClient.get.mockRejectedValueOnce(error);
    await expect(getActiveReorderAlerts('branch-1')).rejects.toBe(error);
  });
});
