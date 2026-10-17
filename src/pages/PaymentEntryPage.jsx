import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getOrder } from '../services/orderService';
import { getPaymentStatus, initiatePayment } from '../services/paymentService';
import { formatCurrency } from '../utils/formatCurrency';
import './PaymentEntryPage.css';

const PAYMENT_ORDER_STORAGE_KEY = 'osms.payment.orderId';

function safePaymentError(error) {
  switch (error?.code) {
    case 'PAYMENT_UNAVAILABLE':
      return 'Online payment is temporarily unavailable. Please try again later.';

    case 'PAYMENT_BILLING_REQUIRED':
      return 'Some billing information is missing. Please complete the billing fields and try again.';

    case 'ORDER_ALREADY_PAID':
      return 'This order has already been paid. Another payment is not required.';

    case 'ORDER_PAYMENT_EXPIRED':
      return 'The payment window for this order has expired. Please return to your cart and create a new order.';

    case 'ORDER_NOT_PAYABLE':
      return 'This order is no longer available for payment.';

    case 'PAYMENT_RECONCILIATION_REQUIRED':
      return 'This payment is being reviewed. Please do not start another payment attempt.';

    case 'ORDER_NOT_FOUND':
      return 'This order could not be found or is not available to your account.';

    default:
      break;
  }

  if (error?.status === 403 || error?.status === 404) {
    return 'This order is not available to your account.';
  }

  if (error?.status === 0) {
    return 'We could not confirm the payment request because the connection was interrupted.';
  }

  if (error?.status === 400 || error?.status === 422) {
    return 'Please check the billing information and try again.';
  }

  return 'We could not prepare this payment. Please try again.';
}

function statusLabel(status) {
  if (typeof status !== 'string' || !status.trim()) {
    return 'Unavailable';
  }

  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function orderItems(order) {
  const items = order?.items ?? order?.orderItems;

  return Array.isArray(items) ? items : [];
}

function itemName(item) {
  return item?.itemName ?? item?.productName ?? item?.name ?? 'Order item';
}

function itemPrice(item) {
  const price = Number(item?.price ?? item?.unitPrice);

  return Number.isFinite(price) ? price : null;
}

function splitCustomerName(name) {
  if (typeof name !== 'string') {
    return {
      firstName: '',
      lastName: '',
    };
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function PaymentEntryPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const defaultName = useMemo(
    () => splitCustomerName(user?.name),
    [user?.name],
  );

  const [order, setOrder] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const [billing, setBilling] = useState({
    firstName: defaultName.firstName,
    lastName: defaultName.lastName,
    address: '',
    city: '',
  });

  const [preparedPayment, setPreparedPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uncertainInitiation, setUncertainInitiation] = useState(false);
  const [pageError, setPageError] = useState('');

  const loadPaymentContext = useCallback(
    async ({ refreshing = false } = {}) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setPageError('');

      try {
        const [loadedOrder, loadedStatus] = await Promise.all([
          getOrder(orderId),
          getPaymentStatus(orderId),
        ]);

        setOrder(loadedOrder);
        setPaymentStatus(loadedStatus);
        setPreparedPayment(null);
        setUncertainInitiation(false);
      } catch (error) {
        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        setPageError(safePaymentError(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [logout, navigate, orderId],
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Payment | Darshana Opticals';

    loadPaymentContext();

    return () => {
      document.title = previousTitle;
    };
  }, [loadPaymentContext]);

  function handleBillingChange(event) {
    const { name, value } = event.target;

    setBilling((current) => ({
      ...current,
      [name]: value,
    }));

    setPageError('');
  }

  async function handlePreparePayment(event) {
    event.preventDefault();

    if (isPreparing || uncertainInitiation) {
      return;
    }

    const city = billing.city.trim();

    if (!city) {
      setPageError('Enter your billing city to continue.');
      return;
    }

    setIsPreparing(true);
    setPageError('');

    const request = {
      orderId,
      city,
    };

    const optionalValues = {
      firstName: billing.firstName.trim(),
      lastName: billing.lastName.trim(),
      address: billing.address.trim(),
    };

    for (const [key, value] of Object.entries(optionalValues)) {
      if (value) {
        request[key] = value;
      }
    }

    try {
      const result = await initiatePayment(request);

      setPreparedPayment(result);
      setPaymentStatus((current) =>
        current
          ? {
              ...current,
              latestAttempt: result.payment,
            }
          : current,
      );
    } catch (error) {
      if (error?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      if (error?.status === 0) {
        setUncertainInitiation(true);
      }

      if (error?.code === 'ORDER_ALREADY_PAID') {
        await loadPaymentContext({ refreshing: true });
        return;
      }

      setPreparedPayment(null);
      setPageError(safePaymentError(error));
    } finally {
      setIsPreparing(false);
    }
  }

  function rememberOrderForProviderReturn() {
    try {
      sessionStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, orderId);
    } catch {
      // A safe order reference is helpful for return recovery but is not
      // required for PayHere form submission itself.
    }
  }

  const paid = Boolean(paymentStatus?.summary?.paid);
  const reconciliationRequired = Boolean(
    paymentStatus?.summary?.reconciliationRequired,
  );

  const items = orderItems(order);
  const orderAmount = Number(order?.orderAmount ?? order?.totalAmount);

  if (isLoading) {
    return (
      <section className="payment-page">
        <p className="payment-page__state" role="status">
          Loading secure payment...
        </p>
      </section>
    );
  }

  if (!order || !paymentStatus) {
    return (
      <section className="payment-page">
        <div className="payment-page__state payment-page__state--error">
          <h1>Payment unavailable</h1>

          <p role="alert">{pageError || 'We could not load this payment.'}</p>

          <Link to="/orders">Back to My Orders</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="payment-page" aria-labelledby="payment-title">
      <div className="payment-stepper" aria-label="Checkout progress">
        <div className="payment-step payment-step--complete">
          <span aria-hidden="true">✓</span>
          <strong>Shipping</strong>
        </div>

        <div className="payment-step__line payment-step__line--active" />

        <div className="payment-step payment-step--active">
          <span aria-hidden="true">2</span>
          <strong>Payment</strong>
        </div>

        <div className="payment-step__line" />

        <div className="payment-step">
          <span aria-hidden="true">3</span>
          <strong>Review</strong>
        </div>
      </div>

      <div className="payment-layout">
        <main className="payment-card">
          <header className="payment-card__header">
            <h1 id="payment-title">Payment Details</h1>

            <p>
              Pay securely through PayHere. Card details are entered only on
              PayHere and are never collected by Darshana Opticals.
            </p>
          </header>

          <div className="payment-provider-card">
            <div className="payment-provider-card__icon" aria-hidden="true">
              🔒
            </div>

            <div>
              <strong>PayHere Secure Checkout</strong>
              <span>Approved online payment method</span>
            </div>
          </div>

          {pageError ? (
            <div
              className="payment-message payment-message--error"
              role="alert"
            >
              {pageError}
            </div>
          ) : null}

          {paid ? (
            <section className="payment-result payment-result--success">
              <h2>Payment completed</h2>

              <p>
                This order is already paid. Another payment is not required.
              </p>

              {paymentStatus.completedAttempt ? (
                <dl>
                  <div>
                    <dt>Amount</dt>
                    <dd>
                      {formatCurrency(paymentStatus.completedAttempt.amount)}
                    </dd>
                  </div>

                  <div>
                    <dt>Status</dt>
                    <dd>
                      {statusLabel(paymentStatus.completedAttempt.status)}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <Link to={`/orders/${orderId}`}>View Order</Link>
            </section>
          ) : reconciliationRequired ? (
            <section className="payment-result payment-result--pending">
              <h2>Payment review in progress</h2>

              <p>
                This payment needs verification. Please do not start another
                payment attempt.
              </p>

              <button
                type="button"
                onClick={() => loadPaymentContext({ refreshing: true })}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Checking...' : 'Check Payment Status'}
              </button>
            </section>
          ) : preparedPayment ? (
            <section className="payment-review" aria-live="polite">
              <h2>Review Payment</h2>

              <dl className="payment-review__details">
                <div>
                  <dt>Amount</dt>
                  <dd>{formatCurrency(preparedPayment.payment.amount)}</dd>
                </div>

                <div>
                  <dt>Currency</dt>
                  <dd>{preparedPayment.payment.currency}</dd>
                </div>

                <div>
                  <dt>Method</dt>
                  <dd>PayHere</dd>
                </div>

                <div>
                  <dt>Status</dt>
                  <dd>{statusLabel(preparedPayment.payment.status)}</dd>
                </div>
              </dl>

              <div className="payment-message payment-message--info">
                Payment is not complete yet. Darshana Opticals will confirm the
                final result only after the backend verifies PayHere&apos;s
                payment notification.
              </div>

              <form
                action={preparedPayment.gateway.checkoutUrl}
                method="post"
                onSubmit={rememberOrderForProviderReturn}
              >
                {Object.entries(preparedPayment.gateway.fields).map(
                  ([name, value]) => (
                    <input
                      key={name}
                      type="hidden"
                      name={name}
                      value={String(value)}
                    />
                  ),
                )}

                <div className="payment-actions">
                  <Link
                    to={`/orders/${orderId}`}
                    className="payment-button payment-button--secondary"
                  >
                    Back to Order
                  </Link>

                  <button type="submit" className="payment-button">
                    Continue to PayHere
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <form className="payment-form" onSubmit={handlePreparePayment}>
              <h2>Billing Information</h2>

              <p className="payment-form__hint">
                Name and address can use the details already saved on your
                customer profile. Enter them here only if you need to provide or
                override them for this payment.
              </p>

              <div className="payment-form__grid">
                <label>
                  <span>First name</span>
                  <input
                    type="text"
                    name="firstName"
                    value={billing.firstName}
                    onChange={handleBillingChange}
                    maxLength={120}
                    autoComplete="given-name"
                    disabled={isPreparing}
                  />
                </label>

                <label>
                  <span>Last name</span>
                  <input
                    type="text"
                    name="lastName"
                    value={billing.lastName}
                    onChange={handleBillingChange}
                    maxLength={120}
                    autoComplete="family-name"
                    disabled={isPreparing}
                  />
                </label>

                <label className="payment-form__wide">
                  <span>Address</span>
                  <input
                    type="text"
                    name="address"
                    value={billing.address}
                    onChange={handleBillingChange}
                    maxLength={120}
                    autoComplete="street-address"
                    disabled={isPreparing}
                  />
                </label>

                <label className="payment-form__wide">
                  <span>
                    Billing city <strong aria-hidden="true">*</strong>
                  </span>
                  <input
                    type="text"
                    name="city"
                    value={billing.city}
                    onChange={handleBillingChange}
                    maxLength={120}
                    autoComplete="address-level2"
                    disabled={isPreparing}
                    aria-required="true"
                  />
                </label>
              </div>

              {uncertainInitiation ? (
                <div className="payment-recovery">
                  <p>
                    Before trying again, check the backend payment status to
                    avoid starting an unnecessary duplicate attempt.
                  </p>

                  <button
                    type="button"
                    onClick={() => loadPaymentContext({ refreshing: true })}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? 'Checking...' : 'Check Payment Status'}
                  </button>
                </div>
              ) : null}

              <div className="payment-actions">
                <Link
                  to={`/orders/${orderId}`}
                  className="payment-button payment-button--secondary"
                >
                  Back to Order
                </Link>

                <button
                  type="submit"
                  className="payment-button"
                  disabled={isPreparing || uncertainInitiation}
                  aria-busy={isPreparing}
                >
                  {isPreparing
                    ? 'Preparing Payment...'
                    : paymentStatus.summary.activeAttempt
                      ? 'Resume Payment'
                      : 'Review Payment'}
                </button>
              </div>
            </form>
          )}
        </main>

        <aside
          className="payment-summary"
          aria-labelledby="payment-summary-title"
        >
          <h2 id="payment-summary-title">Order Summary</h2>

          <p className="payment-summary__order">
            Order <strong>#{orderId}</strong>
          </p>

          {items.length > 0 ? (
            <ul>
              {items.map((item, index) => {
                const price = itemPrice(item);
                const quantity = Number(item.quantity) || 1;

                return (
                  <li key={item.id ?? `${itemName(item)}-${index}`}>
                    <div>
                      <strong>{itemName(item)}</strong>
                      <span>Qty {quantity}</span>
                    </div>

                    <strong>
                      {price === null
                        ? 'Unavailable'
                        : formatCurrency(price * quantity)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="payment-summary__empty">
              Item details are unavailable for this order.
            </p>
          )}

          <div className="payment-summary__total">
            <span>Order Total</span>
            <strong>
              {Number.isFinite(orderAmount)
                ? formatCurrency(orderAmount)
                : 'Unavailable'}
            </strong>
          </div>

          <div className="payment-summary__secure">
            <span aria-hidden="true">🔒</span>
            <p>Card information is entered securely on PayHere, not in OSMS.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default PaymentEntryPage;
