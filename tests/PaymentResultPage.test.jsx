import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentResultPage from '../src/pages/PaymentResultPage';
import useAuth from '../src/hooks/useAuth';
import { getPaymentStatus } from '../src/services/paymentService';

vi.mock('../src/hooks/useAuth', () => ({
  default: vi.fn(),
}));

vi.mock('../src/services/paymentService', () => ({
  getPaymentStatus: vi.fn(),
}));

const orderId = '507f1f77bcf86cd799439021';
const paymentId = '507f1f77bcf86cd799439031';

const completedAttempt = {
  paymentId,
  orderId,
  amount: 29000,
  currency: 'LKR',
  method: 'online_gateway',
  status: 'completed',
  expiresAt: '2099-10-17T10:00:00.000Z',
  reconciliationRequired: false,
};

const logout = vi.fn();

function paymentStatus(status, overrides = {}) {
  const attempt =
    status === null
      ? null
      : {
          ...completedAttempt,
          status,
        };

  return {
    orderId,
    orderStatus: status === 'completed' ? 'PROCESSING' : 'ORDER_CREATED',
    summary: {
      paid: status === 'completed',
      reconciliationRequired: false,
      activeAttempt: status === 'pending' || status === 'processing',
      attemptCount: attempt ? 1 : 0,
    },
    latestAttempt: attempt,
    completedAttempt: status === 'completed' ? attempt : null,
    attempts: attempt ? [attempt] : [],
    ...overrides,
  };
}

function renderPage(source = '') {
  const suffix = source ? `?source=${source}` : '';

  return render(
    <MemoryRouter initialEntries={[`/payments/result/${orderId}${suffix}`]}>
      <Routes>
        <Route
          path="/payments/result/:orderId"
          element={<PaymentResultPage />}
        />

        <Route path="/login" element={<div>Login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaymentResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: {
        id: '507f1f77bcf86cd799439001',
        role: 'CUSTOMER',
      },
      logout,
    });
  });

  it('shows success only when the backend confirms completed Payment', async () => {
    getPaymentStatus.mockResolvedValueOnce(paymentStatus('completed'));

    renderPage('return');

    expect(screen.getByText('Checking payment status...')).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment completed',
      }),
    ).toBeInTheDocument();

    expect(getPaymentStatus).toHaveBeenCalledWith(orderId);
    expect(screen.getByText('Rs.29,000')).toBeInTheDocument();
    expect(screen.getByText('LKR')).toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Retry Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not treat a PayHere browser return as proof of success', async () => {
    getPaymentStatus.mockResolvedValueOnce(paymentStatus('pending'));

    renderPage('return');

    expect(
      await screen.findByRole('heading', {
        name: 'Payment status pending',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/returning from payhere does not by itself confirm/i),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Payment completed',
      }),
    ).not.toBeInTheDocument();
  });

  it('uses backend completion even when the browser came from cancel', async () => {
    getPaymentStatus.mockResolvedValueOnce(paymentStatus('completed'));

    renderPage('cancel');

    expect(
      await screen.findByRole('heading', {
        name: 'Payment completed',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Payment cancelled',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Retry Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('shows failed Payment from backend status with an eligible retry action', async () => {
    getPaymentStatus.mockResolvedValueOnce(paymentStatus('failed'));

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment failed',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Retry Payment',
      }),
    ).toHaveAttribute('href', `/payments/${orderId}`);
  });

  it('shows cancelled Payment from backend status with an eligible retry action', async () => {
    getPaymentStatus.mockResolvedValueOnce(paymentStatus('cancelled'));

    renderPage('cancel');

    expect(
      await screen.findByRole('heading', {
        name: 'Payment cancelled',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: 'Retry Payment',
      }),
    ).toHaveAttribute('href', `/payments/${orderId}`);
  });

  it('shows processing without allowing the redirect to imply success', async () => {
    getPaymentStatus.mockResolvedValueOnce(paymentStatus('processing'));

    renderPage('return');

    expect(
      await screen.findByRole('heading', {
        name: 'Payment processing',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Payment completed',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Retry Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not offer retry after the original payment window has expired', async () => {
    const expiredStatus = paymentStatus('failed');

    expiredStatus.latestAttempt = {
      ...expiredStatus.latestAttempt,
      expiresAt: '2000-01-01T00:00:00.000Z',
    };

    expiredStatus.attempts = [expiredStatus.latestAttempt];

    getPaymentStatus.mockResolvedValueOnce(expiredStatus);

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment failed',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Retry Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('shows payment review instead of failure while reconciliation is required', async () => {
    const reconciliationStatus = paymentStatus('failed');

    reconciliationStatus.summary = {
      ...reconciliationStatus.summary,
      reconciliationRequired: true,
    };

    getPaymentStatus.mockResolvedValueOnce(reconciliationStatus);

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment review required',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/needs additional verification/i),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Payment failed',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Retry Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not show an unqualified completion while reconciliation is required', async () => {
    const reconciliationStatus = paymentStatus('completed');

    reconciliationStatus.summary = {
      ...reconciliationStatus.summary,
      reconciliationRequired: true,
    };

    getPaymentStatus.mockResolvedValueOnce(reconciliationStatus);

    renderPage('return');

    expect(
      await screen.findByRole('heading', {
        name: 'Payment review required',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/do not start another payment attempt/i),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: 'Payment completed',
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Retry Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not offer retry when the Order is no longer eligible for payment', async () => {
    getPaymentStatus.mockResolvedValueOnce(
      paymentStatus('failed', {
        orderStatus: 'CANCELLED',
      }),
    );

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Payment failed',
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('link', {
        name: 'Retry Payment',
      }),
    ).not.toBeInTheDocument();
  });

  it('allows the customer to manually refresh authoritative status', async () => {
    const user = userEvent.setup();

    getPaymentStatus
      .mockResolvedValueOnce(paymentStatus('pending'))
      .mockResolvedValueOnce(paymentStatus('completed'));

    renderPage('return');

    await screen.findByRole('heading', {
      name: 'Payment status pending',
    });

    await user.click(
      screen.getByRole('button', {
        name: 'Check Again',
      }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Payment completed',
      }),
    ).toBeInTheDocument();

    expect(getPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it('shows a safe ownership error for unavailable Orders', async () => {
    getPaymentStatus.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), {
        status: 403,
      }),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This order is not available to your account.',
    );
  });

  it('follows existing session behavior when authentication expires', async () => {
    getPaymentStatus.mockRejectedValueOnce(
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
