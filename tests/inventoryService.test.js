import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  getBranchInventory,
  createInventoryItem,
  updateInventoryItem,
  overrideInventoryPrice,
} from '../src/services/inventoryService';

vi.mock('../src/services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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

describe('inventoryService mutations', () => {
  it('creates an item with only approved fields', async () => {
    const item = {
      itemName: 'Frame',
      category: 'Men',
      brand: 'Nova',
      price: 1200,
      quantity: 3,
    };
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: { _id: 'new-item' },
    });
    await expect(
      createInventoryItem('branch-1', {
        ...item,
        role: 'SYSTEM_ADMIN',
        isLowStock: true,
      }),
    ).resolves.toEqual({ _id: 'new-item' });
    expect(apiClient.post).toHaveBeenCalledWith('/inventory', {
      branchId: 'branch-1',
      ...item,
    });
  });

  it('updates permitted metadata without sending quantity or alert state', async () => {
    apiClient.patch.mockResolvedValueOnce({
      success: true,
      data: { _id: 'item-1' },
    });
    await updateInventoryItem('item-1', {
      itemName: 'Frame',
      category: 'Men',
      brand: 'Nova',
      price: 100,
      quantity: 99,
      alertStatus: 'RESOLVED',
      branchId: 'branch-2',
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/inventory/item-1', {
      itemName: 'Frame',
      category: 'Men',
      brand: 'Nova',
      price: 100,
    });
  });

  it('sends strictly price-only payload for System Admin override', async () => {
    apiClient.patch.mockResolvedValueOnce({
      success: true,
      data: { _id: 'item-2', price: 250 },
    });
    await overrideInventoryPrice('item-2', 250);
    expect(apiClient.patch).toHaveBeenCalledWith('/inventory/item-2', {
      price: 250,
    });
  });

  it('does not treat an unsuccessful mutation response as persisted', async () => {
    apiClient.post.mockResolvedValueOnce({ success: false });
    await expect(
      createInventoryItem('branch-1', {
        itemName: 'Frame',
        category: 'Men',
        brand: 'Nova',
        price: 100,
        quantity: 3,
      }),
    ).rejects.toThrow('Invalid inventory creation response');
  });
});
