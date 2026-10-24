import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getOrder } from '../services/orderService';
import StaffOrderStatusControl from '../components/orders/StaffOrderStatusControl';
import {
  orderId,
  orderDate,
  orderTotal,
  dateLabel,
  dateTimeLabel,
  moneyLabel,
  statusLabel,
} from '../components/orders/orderView';
import '../components/orders/orders.css';

export default function StaffOrderDetailsPage() {
  const { id } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(
    async (isActive = () => true) => {
      setLoading(true);
      setError('');

      try {
        const result = await getOrder(id);

        if (isActive()) {
          setOrder(result);
        }
      } catch (err) {
        if (!isActive()) return;

        setOrder(null);

        if (err.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        if (err.status === 403) {
          setError('You do not have permission to view this order.');
        } else if (err.status === 404) {
          setError('Order not found.');
        } else if (err.status === 0) {
          setError('Cannot connect to the server. Please try again.');
        } else {
          setError('Unable to load order details. Please try again.');
        }
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [id, logout, navigate],
  );

  useEffect(() => {
    let active = true;

    loadOrder(() => active);

    return () => {
      active = false;
    };
  }, [loadOrder]);

  const history = order?.statusHistory;
  const items = order?.items;

  return (
    <section className="orders-page">
      <header className="orders-heading">
        <h1>Staff Order Management</h1>
        <p>View customer order details and tracking information.</p>
      </header>

      <section
        className="orders-card"
        aria-labelledby="staff-order-details-title"
      >
        <Link to="/staff/orders" className="orders-back">
          Back to Staff Orders
        </Link>

        {loading ? (
          <p role="status" className="orders-state">
            Loading order details...
          </p>
        ) : error ? (
          <div role="alert" className="orders-state">
            <p>{error}</p>
            <button type="button" onClick={() => loadOrder()}>
              Try Again
            </button>
          </div>
        ) : order ? (
          <>
            <div className="orders-card-header">
              <div>
                <h2 id="staff-order-details-title">
                  Order #{orderId(order) ?? id}
                </h2>
                <p>Placed on {dateLabel(orderDate(order))}</p>
              </div>

              <span className="orders-status">{statusLabel(order.status)}</span>
            </div>

            <div className="orders-section" aria-label="Customer Information">
              <h3>Customer Information</h3>
              <p className="orders-muted">
                Name: {order.customer?.name || 'Not available'}
              </p>
              <p className="orders-muted">
                Phone: {order.customer?.phone || 'Not available'}
              </p>
              <p className="orders-muted">
                Registered Address:{' '}
                {order.customer?.address?.trim() || 'Not available'}
              </p>
              <p className="orders-muted">
                Order Address:{' '}
                {order.orderAddress?.trim() || 'Not confirmed yet'}
              </p>
            </div>

            <div className="orders-section">
              <h3>Order Tracking History</h3>
              <p className="orders-muted">
                Confirmed tracking information from the backend
              </p>

              {Array.isArray(history) && history.length > 0 ? (
                <ol className="orders-timeline">
                  {history.map((event, index) => (
                    <li key={index}>
                      <strong>{statusLabel(event.status)}</strong>
                      <span>{dateTimeLabel(event.changedAt)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="orders-muted">
                  Tracking history is not available.
                </p>
              )}
            </div>

            <div className="orders-section">
              <h3>Items in This Order</h3>

              {Array.isArray(items) && items.length > 0 ? (
                <ul className="orders-items">
                  {items.map((item, index) => (
                    <li key={item.id ?? index}>
                      <span>{item.itemName ?? 'Order item'}</span>
                      <small>Qty {item.quantity ?? 'Unavailable'}</small>
                      <strong>{moneyLabel(item.price)}</strong>
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
            <StaffOrderStatusControl
              order={order}
              onUpdated={(updatedOrder) =>
                setOrder((current) => ({
                  ...updatedOrder,
                  customer: updatedOrder.customer ?? current?.customer ?? null,
                  orderAddress:
                    updatedOrder.orderAddress?.trim() ||
                    current?.orderAddress ||
                    '',
                }))
              }
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => loadOrder()}
            >
              Refresh Tracking
            </button>
          </>
        ) : null}
      </section>
    </section>
  );
}
