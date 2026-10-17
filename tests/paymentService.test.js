import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  getPaymentStatus,
  initiatePayment,
} from '../src/services/paymentService';

vi.mock('../src/services/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const orderId = '507f1f77bcf86cd799439021';
const paymentId = '507f1f77bcf86cd799439031';

const paymentAttempt = {
  paymentId,
  orderId,
  amount: 29000,
  currency: 'LKR',
  method: 'online_gateway',
  status: 'pending',
  expiresAt: '2026-10-17T09:00:00.000Z',
  reconciliationRequired: false,
  createdAt: '2026-10-17T08:30:00.000Z',
  updatedAt: '2026-10-17T08:30:00.000Z',
};

const gateway = {
  checkoutUrl: 'https://sandbox.payhere.lk/pay/checkout',
  fields: {
    merchant_id: '1234567',
    return_url: 'http://localhost:5173/payment/return',
    cancel_url: 'http://localhost:5173/payment/return',
    notify_url: 'https://example.ngrok-free.app/api/payments/notify',
    first_name: 'Sachini',
    last_name: 'Uresha',
    email: 'customer@example.com',
    phone: '0771234567',
    address: '123 Main Street',
    city: 'Colombo',
    country: 'Sri Lanka',
    order_id: `PAY-${paymentId}`,
    items: `OSMS Order ${orderId}`,
    currency: 'LKR',
    amount: '29000.00',
    hash: '0123456789ABCDEF0123456789ABCDEF',
  },
};

const initiationResponse = {
  success: true,
  data: {
    payment: paymentAttempt,
    gateway,
  },
};

const paymentStatusResponse = {
  success: true,
  data: {
    orderId,
    orderStatus: 'ORDER_CREATED',
    summary: {
      paid: false,
      reconciliationRequired: false,
      activeAttempt: true,
      attemptCount: 1,
    },
    latestAttempt: paymentAttempt,
    completedAttempt: null,
    attempts: [paymentAttempt],
  },
};

describe('paymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initiates payment using only the supported backend fields', async () => {
    apiClient.post.mockResolvedValueOnce(initiationResponse);

    await initiatePayment({
      orderId,
      city: ' Colombo ',
      firstName: ' Sachini ',
      lastName: ' Uresha ',
      address: ' 123 Main Street ',
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/payments/initiate',
      {
        orderId,
        city: 'Colombo',
        firstName: 'Sachini',
        lastName: 'Uresha',
        address: '123 Main Street',
      },
      {
        authenticated: true,
      },
    );
  });

  it('does not submit authoritative payment values from the frontend', async () => {
    apiClient.post.mockResolvedValueOnce(initiationResponse);

    await initiatePayment({
      orderId,
      city: 'Colombo',
    });

    const [, body] = apiClient.post.mock.calls[0];

    expect(body).toEqual({
      orderId,
      city: 'Colombo',
    });

    expect(body).not.toHaveProperty('amount');
    expect(body).not.toHaveProperty('currency');
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('method');
    expect(body).not.toHaveProperty('paymentId');
    expect(body).not.toHaveProperty('customerId');
  });

  it('returns the backend-authoritative payment and PayHere checkout data', async () => {
    apiClient.post.mockResolvedValueOnce(initiationResponse);

    const result = await initiatePayment({
      orderId,
      city: 'Colombo',
    });

    expect(result.payment).toEqual(paymentAttempt);
    expect(result.gateway).toEqual(gateway);

    expect(result.payment.amount).toBe(29000);
    expect(result.payment.currency).toBe('LKR');
    expect(result.payment.status).toBe('pending');
  });

  it('rejects an invalid order ID before making an initiation request', async () => {
    await expect(
      initiatePayment({
        orderId: 'invalid-order',
        city: 'Colombo',
      }),
    ).rejects.toThrow('A valid order ID is required.');

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('requires the billing city before payment initiation', async () => {
    await expect(
      initiatePayment({
        orderId,
        city: '   ',
      }),
    ).rejects.toThrow('city must be between 1 and 120 characters.');

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('rejects an unexpected gateway field instead of forwarding unsafe provider data', async () => {
    apiClient.post.mockResolvedValueOnce({
      ...initiationResponse,
      data: {
        ...initiationResponse.data,
        gateway: {
          ...gateway,
          fields: {
            ...gateway.fields,
            merchant_secret: 'must-not-reach-browser-workflow',
          },
        },
      },
    });

    await expect(
      initiatePayment({
        orderId,
        city: 'Colombo',
      }),
    ).rejects.toThrow(
      'Invalid payment initiation response received from the server.',
    );
  });

  it('rejects an invalid PayHere checkout URL', async () => {
    apiClient.post.mockResolvedValueOnce({
      ...initiationResponse,
      data: {
        ...initiationResponse.data,
        gateway: {
          ...gateway,
          checkoutUrl: 'http://sandbox.payhere.lk/pay/checkout',
        },
      },
    });

    await expect(
      initiatePayment({
        orderId,
        city: 'Colombo',
      }),
    ).rejects.toThrow(
      'Invalid payment initiation response received from the server.',
    );
  });

  it('rejects malformed payment initiation data', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: {
        payment: {
          ...paymentAttempt,
          amount: 'invalid',
        },
        gateway,
      },
    });

    await expect(
      initiatePayment({
        orderId,
        city: 'Colombo',
      }),
    ).rejects.toThrow(
      'Invalid payment initiation response received from the server.',
    );
  });

  it('propagates backend payment initiation errors to the UI layer', async () => {
    const error = Object.assign(
      new Error('Payment gateway is temporarily unavailable.'),
      {
        status: 503,
        code: 'PAYMENT_UNAVAILABLE',
      },
    );

    apiClient.post.mockRejectedValueOnce(error);

    await expect(
      initiatePayment({
        orderId,
        city: 'Colombo',
      }),
    ).rejects.toBe(error);
  });

  it('loads authoritative payment status for the customer order', async () => {
    apiClient.get.mockResolvedValueOnce(paymentStatusResponse);

    const result = await getPaymentStatus(orderId);

    expect(apiClient.get).toHaveBeenCalledTimes(1);

    expect(apiClient.get).toHaveBeenCalledWith(
      `/orders/${orderId}/payment-status`,
      {
        authenticated: true,
      },
    );

    expect(result).toEqual(paymentStatusResponse.data);
    expect(result.summary.paid).toBe(false);
    expect(result.summary.activeAttempt).toBe(true);
    expect(result.latestAttempt.status).toBe('pending');
  });

  it('supports an order with no payment attempts yet', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        orderId,
        orderStatus: 'ORDER_CREATED',
        summary: {
          paid: false,
          reconciliationRequired: false,
          activeAttempt: false,
          attemptCount: 0,
        },
        latestAttempt: null,
        completedAttempt: null,
        attempts: [],
      },
    });

    const result = await getPaymentStatus(orderId);

    expect(result.summary.attemptCount).toBe(0);
    expect(result.latestAttempt).toBeNull();
    expect(result.completedAttempt).toBeNull();
    expect(result.attempts).toEqual([]);
  });

  it('uses backend completed status instead of deriving success locally', async () => {
    const completedAttempt = {
      ...paymentAttempt,
      status: 'completed',
      updatedAt: '2026-10-17T08:40:00.000Z',
    };

    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        orderId,
        orderStatus: 'PROCESSING',
        summary: {
          paid: true,
          reconciliationRequired: false,
          activeAttempt: false,
          attemptCount: 1,
        },
        latestAttempt: completedAttempt,
        completedAttempt,
        attempts: [completedAttempt],
      },
    });

    const result = await getPaymentStatus(orderId);

    expect(result.summary.paid).toBe(true);
    expect(result.completedAttempt.status).toBe('completed');
    expect(result.orderStatus).toBe('PROCESSING');
  });

  it('accepts nullable expiresAt for legacy payment status records', async () => {
    const legacyAttempt = {
      ...paymentAttempt,
      expiresAt: null,
    };

    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        orderId,
        orderStatus: 'ORDER_CREATED',
        summary: {
          paid: false,
          reconciliationRequired: false,
          activeAttempt: false,
          attemptCount: 1,
        },
        latestAttempt: legacyAttempt,
        completedAttempt: null,
        attempts: [legacyAttempt],
      },
    });

    const result = await getPaymentStatus(orderId);

    expect(result.latestAttempt.expiresAt).toBeNull();
    expect(result.attempts[0].expiresAt).toBeNull();
  });

  it('still requires expiresAt for a newly initiated payment', async () => {
    apiClient.post.mockResolvedValueOnce({
      ...initiationResponse,
      data: {
        ...initiationResponse.data,
        payment: {
          ...paymentAttempt,
          expiresAt: null,
        },
      },
    });

    await expect(
      initiatePayment({
        orderId,
        city: 'Colombo',
      }),
    ).rejects.toThrow(
      'Invalid payment initiation response received from the server.',
    );
  });

  it('rejects malformed payment status responses', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        orderId,
        orderStatus: 'ORDER_CREATED',
        summary: {
          paid: 'yes',
          reconciliationRequired: false,
          activeAttempt: true,
          attemptCount: 1,
        },
        latestAttempt: paymentAttempt,
        completedAttempt: null,
        attempts: [paymentAttempt],
      },
    });

    await expect(getPaymentStatus(orderId)).rejects.toThrow(
      'Invalid payment status response received from the server.',
    );
  });

  it('rejects invalid order IDs before requesting payment status', async () => {
    await expect(getPaymentStatus('../another-order')).rejects.toThrow(
      'A valid order ID is required.',
    );

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('propagates backend payment status errors for the page to handle', async () => {
    const error = Object.assign(new Error('Order not found.'), {
      status: 404,
      code: 'ORDER_NOT_FOUND',
    });

    apiClient.get.mockRejectedValueOnce(error);

    await expect(getPaymentStatus(orderId)).rejects.toBe(error);
  });
});
