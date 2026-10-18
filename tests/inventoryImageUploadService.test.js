import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  createInventoryItem,
  uploadInventoryImage,
} from '../src/services/inventoryService';

vi.mock('../src/services/apiClient', () => ({ default: { post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

const validMetadata = {
  imageUrl: 'https://res.cloudinary.com/test/image/upload/frame.jpg',
  imagePublicId: 'osms/inventory/frame-1',
};

describe('inventory image upload service', () => {
  it('uploads one multipart image using the authenticated shared API client', async () => {
    const file = new File(['example'], 'frame.png', { type: 'image/png' });
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: validMetadata,
    });

    await expect(uploadInventoryImage(file)).resolves.toEqual(validMetadata);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/inventory/images',
      expect.any(FormData),
    );
    const form = apiClient.post.mock.calls[0][1];
    expect(form.get('image')).toBe(file);
  });

  it('does not accept invalid provider metadata as an approved upload', async () => {
    const file = new File(['example'], 'frame.png', { type: 'image/png' });
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: { imageUrl: 'http://unsafe', imagePublicId: 'arbitrary' },
    });
    await expect(uploadInventoryImage(file)).rejects.toThrow(
      'Invalid inventory image upload response',
    );
  });

  it('attaches only trusted returned image fields to create request', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: { _id: 'created-1' },
    });
    const values = {
      itemName: 'Frame',
      category: 'Men',
      brand: 'Nova',
      price: 150,
      quantity: 2,
      isLowStock: true,
    };
    await createInventoryItem('branch-1', values, validMetadata);
    expect(apiClient.post).toHaveBeenCalledWith('/inventory', {
      branchId: 'branch-1',
      itemName: 'Frame',
      category: 'Men',
      brand: 'Nova',
      price: 150,
      quantity: 2,
      ...validMetadata,
    });
  });

  it('keeps image optional when creating inventory', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: { _id: 'created-2' },
    });
    await createInventoryItem('branch-1', {
      itemName: 'Frame',
      category: 'Men',
      brand: 'Nova',
      price: 150,
      quantity: 2,
    });
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('imagePublicId');
    expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('imageUrl');
  });
});
