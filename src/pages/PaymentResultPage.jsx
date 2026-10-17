import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getPaymentStatus } from '../services/paymentService';
import { formatCurrency } from '../utils/formatCurrency';
import './PaymentResultPage.css';

function safeResultError(error) {
  if (error?.status === 403 || error?.status === 404) {
    return 'This order is not available to your account.';
  }

  if (error?.status === 0) {
    return 'We could not check the latest payment status. Please check your connection and try again.';
  }

  return 'We could not load the latest payment status. Please try again.';
}

function paymentStatusLabel(status) {
  if (typeof status !== 'string' || !status.trim()) {
    return 'Unavailable';
  }

  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function PaymentResultPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [paymentStatus, setPaymentStatus] = useState(null);
  const [pageError, setPageError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const returnSource = searchParams.get('source');

  const loadStatus = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setPageError('');

      try {
        const result = await getPaymentStatus(orderId);
        setPaymentStatus(result);
      } catch (error) {
        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        setPaymentStatus(null);
        setPageError(safeResultError(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [logout, navigate, orderId],
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Payment Status | Darshana Opticals';

    loadStatus();

    return () => {
      document.title = previousTitle;
    };
  }, [loadStatus]);

  const latestPayment = useMemo(() => {
    if (!paymentStatus) {
      return null;
    }

    return (
      paymentStatus.completedAttempt ?? paymentStatus.latestAttempt ?? null
    );
  }, [paymentStatus]);

  if (isLoading) {
    return (
      <section className="payment-result-page">
        <div className="payment-result-card">
          <p role="status">Checking payment status...</p>
        </div>
      </section>
    );
  }

  if (!paymentStatus) {
    return (
      <section className="payment-result-page">
        <div className="payment-result-card payment-result-card--error">
          <h1>Payment status unavailable</h1>

          <p role="alert">
            {pageError || 'We could not load this payment status.'}
          </p>

          <div className="payment-result-actions">
            <Link to="/orders">My Orders</Link>

            <button
              type="button"
              onClick={() => loadStatus({ refreshing: true })}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Checking...' : 'Try Again'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const paid = Boolean(paymentStatus.summary?.paid);
  const status = latestPayment?.status ?? '';
  const retryExpiry = latestPayment?.expiresAt
    ? new Date(latestPayment.expiresAt).getTime()
    : Number.NaN;

  const retryAllowed =
    (status === 'failed' || status === 'cancelled') &&
    paymentStatus.orderStatus === 'ORDER_CREATED' &&
    !paid &&
    !paymentStatus.summary?.reconciliationRequired &&
    Number.isFinite(retryExpiry) &&
    retryExpiry > Date.now();

  let heading = 'Payment status pending';
  let description =
    'Your payment has not been confirmed yet. Check again shortly for the latest verified status.';
  let stateClass = 'payment-result-card--pending';

  if (paid || status === 'completed') {
    heading = 'Payment completed';
    description =
      'Your payment has been verified successfully. Your order can now continue processing.';
    stateClass = 'payment-result-card--success';
  } else if (status === 'failed') {
    heading = 'Payment failed';
    description =
      'The payment was not completed. No successful payment has been confirmed for this order.';
    stateClass = 'payment-result-card--error';
  } else if (status === 'cancelled') {
    heading = 'Payment cancelled';
    description =
      'The payment was cancelled. Check the latest order status before starting another payment attempt.';
    stateClass = 'payment-result-card--warning';
  } else if (status === 'refunded') {
    heading = 'Payment refunded';
    description = 'The backend reports that this payment has been refunded.';
    stateClass = 'payment-result-card--warning';
  } else if (status === 'processing') {
    heading = 'Payment processing';
    description =
      'The payment is still being verified. Please do not start another payment attempt while verification is in progress.';
  } else if (!latestPayment) {
    heading = 'Payment not confirmed';
    description =
      'No confirmed payment attempt is available for this order yet.';
  }

  return (
    <section
      className="payment-result-page"
      aria-labelledby="payment-result-title"
    >
      <div className={`payment-result-card ${stateClass}`}>
        <div className="payment-result-card__indicator" aria-hidden="true">
          {paid || status === 'completed' ? '✓' : 'i'}
        </div>

        <h1 id="payment-result-title">{heading}</h1>

        <p>{description}</p>

        {returnSource === 'cancel' && !paid ? (
          <p className="payment-result-card__note">
            You returned from the PayHere cancellation flow. The status shown
            here comes from Darshana Opticals&apos; backend, not from the
            browser redirect.
          </p>
        ) : null}

        {returnSource === 'return' ? (
          <p className="payment-result-card__note">
            Returning from PayHere does not by itself confirm a successful
            payment. The status shown here is the latest backend-verified
            result.
          </p>
        ) : null}

        {latestPayment ? (
          <dl className="payment-result-details">
            <div>
              <dt>Status</dt>
              <dd>{paymentStatusLabel(latestPayment.status)}</dd>
            </div>

            <div>
              <dt>Amount</dt>
              <dd>{formatCurrency(latestPayment.amount)}</dd>
            </div>

            <div>
              <dt>Currency</dt>
              <dd>{latestPayment.currency}</dd>
            </div>
          </dl>
        ) : null}

        <div className="payment-result-actions">
          {retryAllowed ? (
            <Link to={`/payments/${encodeURIComponent(orderId)}`}>
              Retry Payment
            </Link>
          ) : null}

          <Link to={`/orders/${orderId}`}>View Order</Link>

          <button
            type="button"
            onClick={() => loadStatus({ refreshing: true })}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Checking...' : 'Check Again'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default PaymentResultPage;
