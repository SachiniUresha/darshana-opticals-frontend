import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getOrders } from '../services/orderService';
import {
  orderId,
  orderDate,
  orderTotal,
  dateLabel,
  moneyLabel,
  statusLabel,
} from '../components/orders/orderView';
import '../components/orders/orders.css';

export default function StaffOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  const loadOrders = useCallback(
    async (isActive = () => true) => {
      setLoading(true);
      setError('');

      try {
        const result = await getOrders();
        if (isActive()) setOrders(result);
      } catch (err) {
        if (!isActive()) return;

        if (err.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        if (err.status === 403) {
          setOrders([]);
          setError('You do not have permission to view staff orders.');
        } else if (err.status === 0) {
          setError('Cannot connect to the server. Please try again.');
        } else {
          setError('Unable to load staff orders. Please try again.');
        }
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [logout, navigate],
  );

  useEffect(() => {
    let active = true;
    loadOrders(() => active);

    return () => {
      active = false;
    };
  }, [loadOrders]);

  return (
    <section className="orders-page">
      <header className="orders-heading">
        <h1>Order Management</h1>
        <p>View and track customer orders.</p>
      </header>

      <section className="orders-card" aria-labelledby="staff-orders-title">
        <div className="orders-card-header">
          <div>
            <h2 id="staff-orders-title">Customer Orders</h2>
            <p>Order information from the backend</p>
          </div>

          <button type="button" onClick={() => loadOrders()} disabled={loading}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="orders-state" role="status">
            Loading staff orders...
          </p>
        ) : error ? (
          <div className="orders-state" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => loadOrders()}>
              Try Again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <p className="orders-state" role="status">
            No customer orders found.
          </p>
        ) : (
          <ul className="orders-list">
            {orders.map((order, index) => {
              const id = orderId(order);

              return (
                <li key={id ?? index} className="orders-order">
                  <div>
                    <h3>Order {id == null ? 'Unavailable' : `#${id}`}</h3>
                    <p>{dateLabel(orderDate(order))}</p>
                    <p>{moneyLabel(orderTotal(order))}</p>
                  </div>

                  <div className="orders-order-actions">
                    <span className="orders-status">
                      {statusLabel(order.status)}
                    </span>

                    {id != null && (
                      <Link to={`/staff/orders/${encodeURIComponent(id)}`}>
                        View Details
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
