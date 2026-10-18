import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  getManagementLoyalty,
  getOwnLoyalty,
} from '../src/services/loyaltyService';

vi.mock('../src/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const TRANSACTION_ID = '68f200000000000000000001';
const CUSTOMER_ID = '68f200000000000000000002';
const ORDER_ID = '68f200000000000000000003';
const PAYMENT_ID = '68f200000000000000000004';

describe('loyaltyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the authenticated Customer loyalty balance and history', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        balance: '285.00',
        transactions: [
          {
            id: TRANSACTION_ID,
            type: 'EARN_PURCHASE',
            pointsDelta: '285.00',
            balanceAfter: '285.00',
            orderId: ORDER_ID,
            createdAt: '2026-10-17T10:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
        },
      },
    });

    const result = await getOwnLoyalty();

    expect(apiClient.get).toHaveBeenCalledWith('/loyalty/me', {
      authenticated: true,
    });

    expect(result).toEqual({
      balance: '285.00',
      transactions: [
        {
          id: TRANSACTION_ID,
          type: 'EARN_PURCHASE',
          pointsDelta: '285.00',
          balanceAfter: '285.00',
          orderId: ORDER_ID,
          createdAt: '2026-10-17T10:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 25,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('accepts the valid zero and empty Customer loyalty state', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        balance: '0.00',
        transactions: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
        },
      },
    });

    await expect(getOwnLoyalty()).resolves.toEqual({
      balance: '0.00',
      transactions: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('uses only documented Customer pagination parameters', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        balance: '0.00',
        transactions: [],
        pagination: {
          page: 2,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      },
    });

    await getOwnLoyalty({
      page: 2,
      limit: 10,
    });

    expect(apiClient.get).toHaveBeenCalledWith('/loyalty/me?page=2&limit=10', {
      authenticated: true,
    });
  });

  it('rejects an invalid Customer loyalty response', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        balance: 285,
        transactions: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
        },
      },
    });

    await expect(getOwnLoyalty()).rejects.toThrow(
      'Invalid customer loyalty response received from the server.',
    );
  });

  it('loads read-only BRANCH_MANAGER loyalty monitoring data', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        transactions: [
          {
            id: TRANSACTION_ID,
            customerId: CUSTOMER_ID,
            orderId: ORDER_ID,
            paymentId: PAYMENT_ID,
            type: 'REFUND_REVERSAL',
            pointsDelta: '-50.00',
            balanceAfter: '235.00',
            createdAt: '2026-10-17T11:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
        },
      },
    });

    const result = await getManagementLoyalty();

    expect(apiClient.get).toHaveBeenCalledWith('/loyalty', {
      authenticated: true,
    });

    expect(result.transactions).toEqual([
      {
        id: TRANSACTION_ID,
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        type: 'REFUND_REVERSAL',
        pointsDelta: '-50.00',
        balanceAfter: '235.00',
        createdAt: '2026-10-17T11:00:00.000Z',
      },
    ]);
  });

  it('sends only documented loyalty monitoring filters', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        transactions: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
    });

    await getManagementLoyalty({
      page: 1,
      limit: 20,
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      eventType: 'EARN_PURCHASE',
      sortOrder: 'asc',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      `/loyalty?page=1&limit=20&customerId=${CUSTOMER_ID}&orderId=${ORDER_ID}&paymentId=${PAYMENT_ID}&eventType=EARN_PURCHASE&sortOrder=asc`,
      {
        authenticated: true,
      },
    );
  });

  it('rejects unsupported loyalty monitoring filter values before requesting', async () => {
    await expect(
      getManagementLoyalty({
        eventType: 'MANUAL_ADJUSTMENT',
      }),
    ).rejects.toThrow('Invalid loyalty event type.');

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('rejects an invalid loyalty monitoring response', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        transactions: [
          {
            id: TRANSACTION_ID,
            customerId: CUSTOMER_ID,
            orderId: ORDER_ID,
            paymentId: PAYMENT_ID,
            type: 'EARN_PURCHASE',
            pointsDelta: 25,
            balanceAfter: '25.00',
            createdAt: '2026-10-17T11:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
        },
      },
    });

    await expect(getManagementLoyalty()).rejects.toThrow(
      'Invalid loyalty monitoring response received from the server.',
    );
  });
});
