import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  getGlobalReorderThreshold,
  updateGlobalReorderThreshold,
} from '../src/services/inventoryService';

vi.mock('../src/services/apiClient', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('global reorder threshold API service', () => {
  it('reads the backend-provided threshold instead of calculating locally', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: { threshold: 8 },
    });
    await expect(getGlobalReorderThreshold()).resolves.toBe(8);
    expect(apiClient.get).toHaveBeenCalledWith('/inventory/reorder-threshold');
  });

  it('updates through the dedicated endpoint using only the numeric threshold', async () => {
    apiClient.put.mockResolvedValueOnce({
      success: true,
      data: { threshold: 2, reconciliation: { totalEvaluated: 4 } },
    });
    await expect(updateGlobalReorderThreshold(2)).resolves.toBe(2);
    expect(apiClient.put).toHaveBeenCalledWith('/inventory/reorder-threshold', {
      threshold: 2,
    });
  });

  it.each([-1, NaN, Infinity, null, '5', undefined])(
    'rejects invalid update values: %s',
    async (value) => {
      await expect(updateGlobalReorderThreshold(value)).rejects.toThrow(
        'non-negative number',
      );
      expect(apiClient.put).not.toHaveBeenCalled();
    },
  );

  it('does not accept a malformed response as an authoritative threshold', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: { threshold: '5' },
    });
    await expect(getGlobalReorderThreshold()).rejects.toThrow(
      'Invalid reorder threshold response',
    );
    apiClient.put.mockResolvedValueOnce({
      success: true,
      data: { threshold: null },
    });
    await expect(updateGlobalReorderThreshold(7)).rejects.toThrow(
      'Invalid reorder threshold update response',
    );
  });

  it('preserves the backend error code for safe transaction-unavailable feedback', async () => {
    const error = Object.assign(new Error('Database internals'), {
      code: 'THRESHOLD_UPDATE_UNAVAILABLE',
      status: 500,
    });
    apiClient.put.mockRejectedValueOnce(error);
    await expect(updateGlobalReorderThreshold(3)).rejects.toBe(error);
  });
});
