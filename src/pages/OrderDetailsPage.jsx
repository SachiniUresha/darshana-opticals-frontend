import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import OrderShell from '../components/orders/OrderShell';
import { getOrder } from '../services/orderService';
import {
  orderId,
  orderTotal,
  orderDate,
  dateLabel,
  moneyLabel,
  statusLabel,
  errorLabel,
} from '../components/orders/orderView';

export default function OrderDetailsPage() {
  const { id } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(
    async (active = () => true) => {
      setLoading(true);
      setError('');
      try {
        const result = await getOrder(id);
        if (active()) setOrder(result);
      } catch (err) {
        if (!active()) return;
        setOrder(null);
        if (err.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(errorLabel(err));
      } finally {
        if (active()) setLoading(false);
      }
    },
    [id, logout, navigate],
  );
  useEffect(() => {
    let active = true;
    const title = document.title;
    document.title = 'Order Details | Darshana Opticals';
    refresh(() => active);
    return () => {
      active = false;
      document.title = title;
    };
  }, [refresh]);
  const history = order?.statusHistory;
  const items = order?.items ?? order?.orderItems;
  return (
    <OrderShell>
      <section className="orders-card" aria-labelledby="details-title">
        <Link to="/orders" className="orders-back">
          Back to My Orders
        </Link>
        {loading ? (
          <p role="status" className="orders-state">
            Loading order details...
          </p>
        ) : error ? (
          <div role="alert" className="orders-state">
            <p>{error}</p>
            <button type="button" onClick={() => refresh()}>
              Try Again
            </button>
          </div>
        ) : order ? (
          <>
            <div className="orders-card-header">
              <div>
                <h2 id="details-title">Order #{orderId(order) ?? id}</h2>
                <p>Placed on {dateLabel(orderDate(order))}</p>
              </div>
              <span className="orders-status">{statusLabel(order.status)}</span>
            </div>
            <div className="orders-section">
              <h3>Order Tracking</h3>
              <p className="orders-muted">Confirmed status history</p>
              {Array.isArray(history) && history.length > 0 ? (
                <ol className="orders-timeline">
                  {history.map((event, index) => (
                    <li key={event.id ?? index}>
                      <strong>{statusLabel(event.status)}</strong>
                      <span>
                        {dateLabel(
                          event.createdAt ?? event.timestamp ?? event.changedAt,
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="orders-muted">
                  Detailed tracking history is not available for this order.
                </p>
              )}
            </div>
            <div className="orders-section">
              <h3>Items in this order</h3>
              {Array.isArray(items) && items.length > 0 ? (
                <ul className="orders-items">
                  {items.map((item, index) => (
                    <li key={item.id ?? index}>
                      <span>
                        {item.itemName ??
                          item.productName ??
                          item.name ??
                          'Order item'}
                      </span>
                      <small>Qty {item.quantity ?? 'Unavailable'}</small>
                      <strong>
                        {moneyLabel(item.unitPrice ?? item.price)}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="orders-muted">Item details are not available.</p>
              )}
            </div>
            <div className="orders-total">
              <strong>Order Total</strong>
              <strong>{moneyLabel(orderTotal(order))}</strong>
            </div>
            <button type="button" onClick={() => refresh()}>
              » Refresh tracking
            </button>
          </>
        ) : null}
      </section>
    </OrderShell>
  );
}
