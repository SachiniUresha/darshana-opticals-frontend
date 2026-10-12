import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from '../src/services/cartService';

vi.mock('../src/services/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const backendCartResponse = {
  success: true,
  data: {
    items: [
      {
        inventoryId: '507f1f77bcf86cd799439011',
        quantity: 2,
      },
    ],
  },
};

describe('cartService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves the authenticated customer cart', async () => {
    apiClient.get.mockResolvedValueOnce(backendCartResponse);

    const cart = await getCart();

    expect(apiClient.get).toHaveBeenCalledWith('/cart', {
      authenticated: true,
    });

    expect(cart).toEqual({
      items: [
        {
          inventoryId: '507f1f77bcf86cd799439011',
          quantity: 2,
        },
      ],
    });
  });

  it('adds an inventory item to the cart', async () => {
    apiClient.post.mockResolvedValueOnce(backendCartResponse);

    await addCartItem('507f1f77bcf86cd799439011', 2);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/cart/items',
      {
        inventoryId: '507f1f77bcf86cd799439011',
        quantity: 2,
      },
      {
        authenticated: true,
      },
    );
  });

  it('uses quantity 1 by default when adding an item', async () => {
    apiClient.post.mockResolvedValueOnce(backendCartResponse);

    await addCartItem('507f1f77bcf86cd799439011');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/cart/items',
      {
        inventoryId: '507f1f77bcf86cd799439011',
        quantity: 1,
      },
      {
        authenticated: true,
      },
    );
  });

  it('updates an item using absolute quantity replacement', async () => {
    apiClient.patch.mockResolvedValueOnce(backendCartResponse);

    await updateCartItemQuantity('507f1f77bcf86cd799439011', 4);

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/cart/items/507f1f77bcf86cd799439011',
      {
        quantity: 4,
      },
      {
        authenticated: true,
      },
    );
  });

  it('removes an item from the cart', async () => {
    apiClient.delete.mockResolvedValueOnce({
      success: true,
      data: {
        items: [],
      },
    });

    const cart = await removeCartItem('507f1f77bcf86cd799439011');

    expect(apiClient.delete).toHaveBeenCalledWith(
      '/cart/items/507f1f77bcf86cd799439011',
      {
        authenticated: true,
      },
    );

    expect(cart).toEqual({
      items: [],
    });
  });

  it('rejects a malformed cart response', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: null,
    });

    await expect(getCart()).rejects.toThrow(
      'Invalid cart response received from the server.',
    );
  });
});
