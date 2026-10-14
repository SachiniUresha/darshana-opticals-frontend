import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import { submitCheckout } from '../src/services/checkoutService';

vi.mock('../src/services/apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

const checkoutResponse = {
  success: true,
  data: {
    order: {
      id: '507f1f77bcf86cd799439021',
      customerId: '507f1f77bcf86cd799439011',
      orderDate: '2026-10-14T02:30:00.000Z',
      orderAmount: 25000,
      status: 'ORDER_CREATED',
      statusUpdatedAt: '2026-10-14T02:30:00.000Z',
      statusHistory: [
        {
          status: 'ORDER_CREATED',
          changedAt: '2026-10-14T02:30:00.000Z',
          changedBy: '507f1f77bcf86cd799439011',
        },
      ],
    },
    items: [
      {
        id: '507f1f77bcf86cd799439031',
        itemName: 'Classic Black Frame',
        price: 12500,
        quantity: 2,
      },
    ],
  },
};

describe('checkoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits checkout using only an empty request body', async () => {
    apiClient.post.mockResolvedValueOnce(checkoutResponse);

    await submitCheckout();

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/checkout',
      {},
      {
        authenticated: true,
      },
    );
  });

  it('returns the authoritative order and items from the backend', async () => {
    apiClient.post.mockResolvedValueOnce(checkoutResponse);

    const result = await submitCheckout();

    expect(result).toEqual(checkoutResponse.data);
    expect(result.order.orderAmount).toBe(25000);
    expect(result.order.status).toBe('ORDER_CREATED');
  });

  it('does not submit client cart values as authoritative checkout data', async () => {
    apiClient.post.mockResolvedValueOnce(checkoutResponse);

    await submitCheckout();

    const [, body] = apiClient.post.mock.calls[0];

    expect(body).toEqual({});
    expect(body).not.toHaveProperty('customerId');
    expect(body).not.toHaveProperty('items');
    expect(body).not.toHaveProperty('price');
    expect(body).not.toHaveProperty('total');
    expect(body).not.toHaveProperty('stock');
  });

  it('rejects a malformed checkout response', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: {
        order: null,
        items: [],
      },
    });

    await expect(submitCheckout()).rejects.toThrow(
      'Invalid checkout response received from the server.',
    );
  });

  it('rejects malformed authoritative checkout items', async () => {
    apiClient.post.mockResolvedValueOnce({
      ...checkoutResponse,
      data: {
        ...checkoutResponse.data,
        items: [
          {
            id: '507f1f77bcf86cd799439031',
            itemName: 'Classic Black Frame',
            price: 12500,
            quantity: 0,
          },
        ],
      },
    });

    await expect(submitCheckout()).rejects.toThrow(
      'Invalid checkout response received from the server.',
    );
  });

  it('propagates backend checkout errors for the UI to handle', async () => {
    const error = Object.assign(new Error('Insufficient Inventory stock.'), {
      status: 409,
      code: 'INSUFFICIENT_STOCK',
    });

    apiClient.post.mockRejectedValueOnce(error);

    await expect(submitCheckout()).rejects.toBe(error);
  });
});
