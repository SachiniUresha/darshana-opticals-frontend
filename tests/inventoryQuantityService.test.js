import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import { updateInventoryQuantity } from '../src/services/inventoryService';

vi.mock('../src/services/apiClient', () => ({
  default: { patch: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('inventory quantity API integration', () => {
  it('uses the dedicated quantity endpoint and sends only the numeric quantity', async () => {
    const updated = { _id: 'item-1', quantity: 0 };
    apiClient.patch.mockResolvedValueOnce({ success: true, data: updated });

    await expect(updateInventoryQuantity('item-1', 0)).resolves.toEqual(
      updated,
    );
    expect(apiClient.patch).toHaveBeenCalledWith('/inventory/item-1/quantity', {
      quantity: 0,
    });
  });

  it.each([-1, 1.5, NaN, Infinity, 2 ** 60, '8', null])(
    'does not send invalid quantity %s',
    async (value) => {
      await expect(updateInventoryQuantity('item-1', value)).rejects.toThrow(
        'non-negative whole number',
      );
      expect(apiClient.patch).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing inventory identifier without sending a request', async () => {
    await expect(updateInventoryQuantity('', 5)).rejects.toThrow(
      'An inventory item is required',
    );
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('does not report a failed or malformed response as successful', async () => {
    apiClient.patch.mockResolvedValueOnce({
      success: false,
      data: { quantity: 2 },
    });
    await expect(updateInventoryQuantity('item-1', 2)).rejects.toThrow(
      'Invalid inventory quantity response',
    );
  });

  it('propagates backend errors for the page to handle safely', async () => {
    const forbidden = Object.assign(new Error('secret internal'), {
      status: 403,
    });
    apiClient.patch.mockRejectedValueOnce(forbidden);
    await expect(updateInventoryQuantity('item-1', 3)).rejects.toBe(forbidden);
  });
});
