import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './apiClient';
import { getOrders, getOrder, updateOrderStatus } from './orderService';

vi.mock('./apiClient', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const sampleOrder = {
  id: '507f1f77bcf86cd799439021',
  customerId: '507f1f77bcf86cd799439011',
  orderDate: '2026-10-08T10:30:00Z',
  orderAmount: 18500,
  status: 'PROCESSING',
  statusHistory: [
    {
      status: 'PROCESSING',
      changedAt: '2026-10-09T10:30:00Z',
    },
  ],
};

describe('orderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrders', () => {
    it('requests customer order history through the shared API client', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: [sampleOrder],
      });

      const result = await getOrders();

      expect(apiClient.get).toHaveBeenCalledWith('/orders');
      expect(result).toEqual([sampleOrder]);
    });

    it('returns an empty array when the customer has no orders', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: [],
      });

      await expect(getOrders()).resolves.toEqual([]);
    });

    it('rejects invalid order history responses', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: {},
      });

      await expect(getOrders()).rejects.toThrow('Invalid orders response');
    });

    it('propagates authentication errors from the API client', async () => {
      const error = Object.assign(new Error('Unauthorized'), {
        status: 401,
      });
      apiClient.get.mockRejectedValue(error);

      await expect(getOrders()).rejects.toBe(error);
    });
  });

  describe('getOrder', () => {
    it('requests order details through the shared API client', async () => {
      const orderDetail = {
        ...sampleOrder,
        items: [
          {
            id: '507f1f77bcf86cd799439031',
            itemName: 'Classic Black Frame',
            price: 18500,
            quantity: 1,
          },
        ],
      };

      apiClient.get.mockResolvedValue({
        success: true,
        data: orderDetail,
      });

      const result = await getOrder(sampleOrder.id);

      expect(apiClient.get).toHaveBeenCalledWith(`/orders/${sampleOrder.id}`);
      expect(result).toEqual(orderDetail);
    });

    it('safely encodes the order identifier', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: sampleOrder,
      });

      await getOrder('order/123');

      expect(apiClient.get).toHaveBeenCalledWith('/orders/order%2F123');
    });

    it('rejects a missing order detail object', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: null,
      });

      await expect(getOrder(sampleOrder.id)).rejects.toThrow(
        'Invalid order response',
      );
    });

    it('rejects an array instead of an order detail object', async () => {
      apiClient.get.mockResolvedValue({
        success: true,
        data: [],
      });

      await expect(getOrder(sampleOrder.id)).rejects.toThrow(
        'Invalid order response',
      );
    });

    it('propagates not-found errors from the API client', async () => {
      const error = Object.assign(new Error('Not found'), {
        status: 404,
      });
      apiClient.get.mockRejectedValue(error);

      await expect(getOrder(sampleOrder.id)).rejects.toBe(error);
    });
  });

  describe('updateOrderStatus', () => {
    it('updates an order using the shared API client', async () => {
      const updatedOrder = {
        ...sampleOrder,
        status: 'READY_FOR_PICKUP',
      };

      apiClient.patch.mockResolvedValue({
        success: true,
        data: updatedOrder,
      });

      const result = await updateOrderStatus(
        sampleOrder.id,
        'READY_FOR_PICKUP',
      );

      expect(apiClient.patch).toHaveBeenCalledWith(
        `/orders/${sampleOrder.id}/status`,
        { status: 'READY_FOR_PICKUP' },
      );

      expect(result).toEqual(updatedOrder);
    });

    it('rejects an invalid response', async () => {
      apiClient.patch.mockResolvedValue({
        success: true,
        data: null,
      });

      await expect(
        updateOrderStatus(sampleOrder.id, 'READY_FOR_PICKUP'),
      ).rejects.toThrow('Invalid order status update response');
    });

    it('propagates authorization errors', async () => {
      const error = Object.assign(new Error('Forbidden'), {
        status: 403,
      });

      apiClient.patch.mockRejectedValue(error);

      await expect(
        updateOrderStatus(sampleOrder.id, 'READY_FOR_PICKUP'),
      ).rejects.toBe(error);
    });
  });
});
