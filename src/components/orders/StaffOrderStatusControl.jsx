import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { BRANCH_ASSISTANT, BRANCH_MANAGER } from '../../config/roles';
import { updateOrderStatus } from '../../services/orderService';
import { statusLabel } from './orderView';
import './StaffOrderStatusControl.css';

// ADR-004: UI choices only. Backend validates every transition.
const ALLOWED_TRANSITIONS = {
  ORDER_CREATED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP'],
  PICKED_UP: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export default function StaffOrderStatusControl({ order, onUpdated }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [selectedStatus, setSelectedStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const successRef = useRef(null);
  const errorRef = useRef(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    } else if (success) {
      successRef.current?.focus();
    }
  }, [error, success]);

  const isAuthorized =
    user?.role === BRANCH_ASSISTANT || user?.role === BRANCH_MANAGER;

  const allowed = ALLOWED_TRANSITIONS[order?.status] ?? [];

  useEffect(() => {
    setSelectedStatus('');
  }, [order?.status, order?.id]);

  if (!isAuthorized || !order) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting || !selectedStatus || !allowed.includes(selectedStatus)) {
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const updatedOrder = await updateOrderStatus(order.id, selectedStatus);

      // Update UI only after backend confirmation.
      onUpdated(updatedOrder);
      setSelectedStatus('');
      setSuccess('Order status updated successfully.');
    } catch (err) {
      if (err.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }

      if (err.status === 403) {
        setError('You do not have permission to update this order.');
      } else if (
        err.status === 400 ||
        err.status === 409 ||
        err.status === 422
      ) {
        setError(
          'Status update was not accepted. Refresh tracking and try again.',
        );
      } else if (err.status === 0) {
        setError('Cannot connect to the server. Please try again.');
      } else {
        setError('Unable to update order status. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="staff-status-control orders-section"
      aria-labelledby="staff-status-title"
    >
      <h3 id="staff-status-title">Update Order Status</h3>

      <p className="orders-muted">
        Current status: <strong>{statusLabel(order.status)}</strong>
      </p>

      {allowed.length === 0 ? (
        <p className="orders-muted">
          No further status transitions are available.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="staff-next-status">Next Order Status</label>

          <div className="staff-status-control__actions">
            <select
              id="staff-next-status"
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setError('');
                setSuccess('');
              }}
              disabled={submitting}
            >
              <option value="">Select next status</option>
              {allowed.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>

            <button type="submit" disabled={submitting || !selectedStatus}>
              {submitting ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="staff-status-error"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          ref={successRef}
          tabIndex={-1}
          role="status"
          className="staff-status-success"
        >
          {success}
        </p>
      )}
    </section>
  );
}
