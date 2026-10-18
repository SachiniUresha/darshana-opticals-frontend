import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  replaceInventoryImage,
  removeInventoryImage,
} from '../src/services/inventoryService';

vi.mock('../src/services/apiClient', () => ({
  default: { patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

const metadata = {
  imageUrl: 'https://res.cloudinary.com/test/image/upload/approved.png',
  imagePublicId: 'osms/inventory/approved',
};

describe('inventory image management service', () => {
  it('updates only approved image fields for the selected inventory item', async () => {
    apiClient.patch.mockResolvedValueOnce({
      success: true,
      data: { _id: 'item-1', ...metadata },
    });
    await expect(
      replaceInventoryImage('item-1', metadata),
    ).resolves.toMatchObject(metadata);
    expect(apiClient.patch).toHaveBeenCalledWith('/inventory/item-1', metadata);
  });

  it('rejects missing or untrusted metadata without calling the API', async () => {
    await expect(
      replaceInventoryImage('item-1', {
        ...metadata,
        imageUrl: 'http://insecure',
      }),
    ).rejects.toThrow();
    await expect(replaceInventoryImage('', metadata)).rejects.toThrow();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('removes images through the dedicated backend endpoint', async () => {
    apiClient.delete.mockResolvedValueOnce({
      success: true,
      data: { _id: 'item-1', imageUrl: null },
    });
    await expect(removeInventoryImage('item-1')).resolves.toMatchObject({
      imageUrl: null,
    });
    expect(apiClient.delete).toHaveBeenCalledWith('/inventory/item-1/image');
  });

  it('does not treat failed backend operations as successful', async () => {
    apiClient.patch.mockRejectedValueOnce(
      Object.assign(new Error('Backend rejected'), { status: 403 }),
    );
    await expect(replaceInventoryImage('item-1', metadata)).rejects.toThrow();
    apiClient.delete.mockResolvedValueOnce({ success: false });
    await expect(removeInventoryImage('item-1')).rejects.toThrow();
  });
});
