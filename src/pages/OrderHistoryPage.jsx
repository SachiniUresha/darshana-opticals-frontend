import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import OrderShell from '../components/orders/OrderShell';
import { getOrders } from '../services/orderService';
import {
  orderId,
  orderTotal,
  orderDate,
  dateLabel,
  moneyLabel,
  statusLabel,
  historyErrorLabel,
} from '../components/orders/orderView';

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();
  const refresh = useCallback(
    async (active = () => true) => {
      setLoading(true);
      setError('');
      try {
        const result = await getOrders();
        if (active()) setOrders(result);
      } catch (err) {
        if (!active()) return;
        if (err.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(historyErrorLabel(err));
      } finally {
        if (active()) setLoading(false);
      }
    },
    [logout, navigate],
  );
  useEffect(() => {
    let active = true;
    const title = document.title;
    document.title = 'My Orders | Darshana Opticals';
    refresh(() => active);
    return () => {
      active = false;
      document.title = title;
    };
  }, [refresh]);
  return (
    <OrderShell>
      <section className="orders-card" aria-labelledby="history-title">
        <div className="orders-card-header">
          <div>
            <h2 id="history-title">Order History</h2>
            <p>Your recent orders</p>
          </div>
          <button type="button" disabled={loading} onClick={() => refresh()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p role="status" className="orders-state">
            Loading your orders...
          </p>
        ) : error ? (
          <div role="alert" className="orders-state">
            <p>{error}</p>
            <button type="button" onClick={() => refresh()}>
              Try Again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <p className="orders-state">
            No orders yet. <Link to="/products">Browse products</Link>
          </p>
        ) : (
          <ul className="orders-list">
            {orders.map((order, index) => {
              const id = orderId(order);
              return (
                <li key={id ?? index} className="orders-order">
                  <div>
                    <h3>Order {id == null ? 'â€”' : `#${id}`}</h3>
                    <p>{dateLabel(orderDate(order))}</p>
                    <p>
                      {Array.isArray(order.items)
                        ? `${order.items.length} item(s)`
                        : 'Order details'}
                    </p>
                    <strong>{moneyLabel(orderTotal(order))}</strong>
                  </div>
                  <div className="orders-order-actions">
                    <span className="orders-status">
                      {statusLabel(order.status)}
                    </span>
                    {id != null && (
                      <Link to={`/orders/${encodeURIComponent(id)}`}>
                        View details
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </OrderShell>
  );
}
