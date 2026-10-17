import { Navigate, Link, useLocation } from 'react-router-dom';
import './PaymentEntryPage.css';

const PAYMENT_ORDER_STORAGE_KEY = 'osms.payment.orderId';
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function readPaymentOrderId() {
  try {
    const storedOrderId = sessionStorage.getItem(PAYMENT_ORDER_STORAGE_KEY);

    if (!storedOrderId || !OBJECT_ID_PATTERN.test(storedOrderId)) {
      return '';
    }

    sessionStorage.removeItem(PAYMENT_ORDER_STORAGE_KEY);

    return storedOrderId;
  } catch {
    return '';
  }
}

function PaymentReturnPage() {
  const location = useLocation();
  const orderId = readPaymentOrderId();

  const source = location.pathname.endsWith('/cancel') ? 'cancel' : 'return';

  if (orderId) {
    return (
      <Navigate
        to={`/payments/result/${encodeURIComponent(orderId)}?source=${source}`}
        replace
      />
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
