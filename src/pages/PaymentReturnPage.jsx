import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './PaymentEntryPage.css';

const PAYMENT_ORDER_STORAGE_KEY = 'osms.payment.orderId';
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function readPaymentOrderId() {
  try {
    const storedOrderId = sessionStorage.getItem(PAYMENT_ORDER_STORAGE_KEY);

    if (!storedOrderId || !OBJECT_ID_PATTERN.test(storedOrderId)) {
      return '';
    }

    return storedOrderId;
  } catch {
    return '';
  }
}

function clearPaymentOrderId(orderId) {
  try {
    if (sessionStorage.getItem(PAYMENT_ORDER_STORAGE_KEY) === orderId) {
      sessionStorage.removeItem(PAYMENT_ORDER_STORAGE_KEY);
    }
  } catch {
    // Payment result recovery must still continue when session storage
    // is unavailable.
  }
}

function PaymentReturnPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orderId] = useState(readPaymentOrderId);

  const source = location.pathname.endsWith('/cancel') ? 'cancel' : 'return';

  useEffect(() => {
    if (!orderId) {
      return;
    }

    navigate(
      `/payments/result/${encodeURIComponent(orderId)}?source=${source}`,
      {
        replace: true,
      },
    );

    clearPaymentOrderId(orderId);
  }, [navigate, orderId, source]);

  if (orderId) {
    return (
      <section className="payment-page">
        <div className="payment-page__state">
          <p role="status">Checking payment status...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="payment-page">
      <div className="payment-page__state payment-page__state--error">
        <h1>Payment status unavailable</h1>

        <p role="alert">
          We could not identify the order for this payment return. Open My
          Orders to check the latest payment status safely.
        </p>

        <Link to="/orders">Go to My Orders</Link>
      </div>
    </section>
  );
}

export default PaymentReturnPage;
