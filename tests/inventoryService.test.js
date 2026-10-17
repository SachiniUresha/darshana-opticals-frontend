import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import { getBranchInventory } from '../src/services/inventoryService';

vi.mock('../src/services/apiClient', () => ({
  default: { get: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('inventoryService', () => {
  it('retrieves backend inventory for the provided branch only', async () => {
    const items = [{ _id: 'item-1', itemName: 'Frame', quantity: 2 }];
    apiClient.get.mockResolvedValueOnce({ success: true, data: items });
    await expect(getBranchInventory('branch-1')).resolves.toEqual(items);
    expect(apiClient.get).toHaveBeenCalledWith('/inventory/branch/branch-1');
  });

  it('does not send an empty branch identifier', async () => {
    await expect(getBranchInventory('')).rejects.toThrow(
      'A branch is required',
    );
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('rejects an unexpected backend response instead of inventing stock data', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: {} });
    await expect(getBranchInventory('branch-1')).rejects.toThrow(
      'Invalid inventory response',
    );
  });

  it('propagates backend authorization errors', async () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 });
    apiClient.get.mockRejectedValueOnce(error);
    await expect(getBranchInventory('branch-1')).rejects.toBe(error);
  });
});
