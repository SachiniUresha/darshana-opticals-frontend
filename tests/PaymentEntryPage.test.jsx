import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentEntryPage from '../src/pages/PaymentEntryPage';
import useAuth from '../src/hooks/useAuth';
import { getOrder } from '../src/services/orderService';
import {
  getPaymentStatus,
  initiatePayment,
} from '../src/services/paymentService';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/orderService', () => ({
  getOrder: vi.fn(),
}));

vi.mock('../src/services/paymentService', () => ({
  getPaymentStatus: vi.fn(),
  initiatePayment: vi.fn(),
}));

const orderId = '507f1f77bcf86cd799439021';
const paymentId = '507f1f77bcf86cd799439031';

const order = {
  id: orderId,
  orderAmount: 29000,
  status: 'ORDER_CREATED',
  items: [
    {
      id: '507f1f77bcf86cd799439041',
      itemName: 'Classic Black Frame',
      price: 12000,
      quantity: 2,
    },
    {
      id: '507f1f77bcf86cd799439042',
      itemName: 'Blue Light Lens',
      price: 5000,
      quantity: 1,
    },
  ],
};

const emptyPaymentStatus = {
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
};

const preparedPayment = {
  payment: {
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
  },
  gateway: {
    checkoutUrl: 'https://sandbox.payhere.lk/pay/checkout',
    fields: {
      merchant_id: '1234567',
      return_url: 'http://localhost:3000/payments/return',
      cancel_url: 'http://localhost:3000/payments/cancel',
      notify_url: 'https://example.test/api/payments/notify',
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
  },
};

const logout = vi.fn();

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/payments/${orderId}`]}>
      <Routes>
        <Route path="/payments/:orderId" element={<PaymentEntryPage />} />
        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaymentEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    useAuth.mockReturnValue({
      user: {
        id: '507f1f77bcf86cd799439001',
        name: 'Sachini Uresha',
        role: 'CUSTOMER',
      },
      logout,
    });

    getOrder.mockResolvedValue(order);
    getPaymentStatus.mockResolvedValue(emptyPaymentStatus);
  });

  it('loads the backend Order and authoritative Payment status', async () => {
    renderPage();

    expect(screen.getByText('Loading secure payment...')).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment Details',
      }),
    ).toBeInTheDocument();

    expect(getOrder).toHaveBeenCalledWith(orderId);
    expect(getPaymentStatus).toHaveBeenCalledWith(orderId);

    expect(screen.getByText('Rs.29,000')).toBeInTheDocument();
    expect(screen.getByText('Classic Black Frame')).toBeInTheDocument();
  });

  it('does not render raw card credential fields', async () => {
    renderPage();

    await screen.findByRole('heading', {
      name: 'Payment Details',
    });

    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cvv|cvc/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/expiry/i)).not.toBeInTheDocument();

    expect(
      screen.getByText(/card details are entered only on payhere/i),
    ).toBeInTheDocument();
  });

  it('requires a billing city before initiating payment', async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('heading', {
      name: 'Payment Details',
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Review Payment',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter your billing city to continue.',
    );

    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it('uses only supported billing fields when initiating Payment', async () => {
    const user = userEvent.setup();

    initiatePayment.mockResolvedValueOnce(preparedPayment);

    renderPage();

    await screen.findByRole('heading', {
      name: 'Payment Details',
    });

    await user.type(screen.getByLabelText('Address'), '123 Main Street');
    await user.type(screen.getByLabelText(/billing city/i), 'Colombo');

    await user.click(
      screen.getByRole('button', {
        name: 'Review Payment',
      }),
    );

    await waitFor(() => {
      expect(initiatePayment).toHaveBeenCalledWith({
        orderId,
        city: 'Colombo',
        firstName: 'Sachini',
        lastName: 'Uresha',
        address: '123 Main Street',
      });
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Review Payment',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('LKR')).toBeInTheDocument();

    const continueButton = screen.getByRole('button', {
      name: 'Continue to PayHere',
    });

    const form = continueButton.closest('form');

    expect(form).toHaveAttribute(
      'action',
      'https://sandbox.payhere.lk/pay/checkout',
    );

    expect(form).toHaveAttribute('method', 'post');

    expect(form.querySelector('input[name="amount"]')).toHaveValue('29000.00');

    expect(form.querySelector('input[name="currency"]')).toHaveValue('LKR');

    expect(form.querySelector('input[name="hash"]')).toHaveValue(
      '0123456789ABCDEF0123456789ABCDEF',
    );
  });

  it('does not return to payment initiation after the PayHere payload is prepared', async () => {
    const user = userEvent.setup();

    initiatePayment.mockResolvedValueOnce(preparedPayment);

    renderPage();

    await screen.findByRole('heading', {
      name: 'Payment Details',
    });

    await user.type(screen.getByLabelText(/billing city/i), 'Colombo');

    await user.click(
      screen.getByRole('button', {
        name: 'Review Payment',
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: 'Continue to PayHere',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Back',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Back to Order',
      }),
    ).toHaveAttribute('href', `/orders/${orderId}`);

    expect(initiatePayment).toHaveBeenCalledTimes(1);
  });

  it('prevents repeated initiation while Payment preparation is pending', async () => {
    const user = userEvent.setup();

    let resolvePayment;

    initiatePayment.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePayment = resolve;
      }),
    );

    renderPage();

    await screen.findByRole('heading', {
      name: 'Payment Details',
    });

    await user.type(screen.getByLabelText(/billing city/i), 'Colombo');

    await user.click(
      screen.getByRole('button', {
        name: 'Review Payment',
      }),
    );

    expect(initiatePayment).toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole('button', {
        name: 'Preparing Payment...',
      }),
    ).toBeDisabled();

    resolvePayment(preparedPayment);

    expect(
      await screen.findByRole('button', {
        name: 'Continue to PayHere',
      }),
    ).toBeInTheDocument();
  });

  it('does not offer another Payment when backend says the Order is paid', async () => {
    getPaymentStatus.mockResolvedValueOnce({
      ...emptyPaymentStatus,
      orderStatus: 'PROCESSING',
      summary: {
        ...emptyPaymentStatus.summary,
        paid: true,
        attemptCount: 1,
      },
      latestAttempt: {
        ...preparedPayment.payment,
        status: 'completed',
      },
      completedAttempt: {
        ...preparedPayment.payment,
        status: 'completed',
      },
      attempts: [
        {
          ...preparedPayment.payment,
          status: 'completed',
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment completed',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Review Payment',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Continue to PayHere',
      }),
    ).not.toBeInTheDocument();
  });

  it('blocks another attempt while reconciliation is required', async () => {
    getPaymentStatus.mockResolvedValueOnce({
      ...emptyPaymentStatus,
      summary: {
        ...emptyPaymentStatus.summary,
        reconciliationRequired: true,
        attemptCount: 1,
      },
      latestAttempt: {
        ...preparedPayment.payment,
        reconciliationRequired: true,
      },
      attempts: [
        {
          ...preparedPayment.payment,
          reconciliationRequired: true,
        },
      ],
    });

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment review in progress',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {
        name: 'Review Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('requires status recovery after an uncertain network failure', async () => {
    const user = userEvent.setup();

    initiatePayment.mockRejectedValueOnce(
      Object.assign(new Error('Network error'), {
        status: 0,
        code: 'NETWORK_ERROR',
      }),
    );

    renderPage();

    await screen.findByRole('heading', {
      name: 'Payment Details',
    });

    await user.type(screen.getByLabelText(/billing city/i), 'Colombo');

    await user.click(
      screen.getByRole('button', {
        name: 'Review Payment',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not confirm the payment request/i,
    );

    expect(
      screen.getByRole('button', {
        name: 'Check Payment Status',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Review Payment',
      }),
    ).toBeDisabled();
  });

  it('follows the existing session behavior when authentication expires', async () => {
    getOrder.mockRejectedValueOnce(
      Object.assign(new Error('Unauthorized'), {
        status: 401,
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Login destination')).toBeInTheDocument();
  });
});
