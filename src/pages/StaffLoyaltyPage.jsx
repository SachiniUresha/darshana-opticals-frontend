import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import {
  getManagementLoyalty,
  LOYALTY_EVENT_TYPES,
} from '../services/loyaltyService';
import './StaffLoyaltyPage.css';

const PAGE_SIZE = 25;

const EVENT_LABELS = {
  EARN_PURCHASE: 'Points Earned',
  REFUND_REVERSAL: 'Refund Reversal',
  REDEMPTION_DEDUCTION: 'Redemption Deduction',
};

const EMPTY_FILTERS = {
  customerId: '',
  orderId: '',
  paymentId: '',
  eventType: '',
  sortOrder: 'desc',
};

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSafeErrorMessage(error) {
  if (error?.status === 403) {
    return 'You do not have permission to monitor loyalty activity.';
  }

  if (error?.status === 422) {
    return 'Please check the loyalty filters and try again.';
  }

  if (
    error?.message === 'customerId must be a valid identifier.' ||
    error?.message === 'orderId must be a valid identifier.' ||
    error?.message === 'paymentId must be a valid identifier.' ||
    error?.message === 'Invalid loyalty event type.' ||
    error?.message === 'Loyalty sort order must be asc or desc.'
  ) {
    return 'Please check the loyalty filters and try again.';
  }

  if (!error?.status || error.status === 0) {
    return 'Cannot connect to the loyalty service. Please try again.';
  }

  return 'Unable to load loyalty activity. Please try again.';
}

export default function StaffLoyaltyPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Loyalty Monitoring | Darshana Opticals';

    let active = true;

    async function loadLoyalty() {
      setLoading(true);
      setErrorMessage('');

      try {
        const result = await getManagementLoyalty({
          page,
          limit: PAGE_SIZE,
          customerId: appliedFilters.customerId,
          orderId: appliedFilters.orderId,
          paymentId: appliedFilters.paymentId,
          eventType: appliedFilters.eventType,
          sortOrder: appliedFilters.sortOrder,
        });

        if (!active) {
          return;
        }

        setTransactions(result.transactions);
        setPagination(result.pagination);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        setTransactions([]);
        setPagination(null);
        setErrorMessage(getSafeErrorMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLoyalty();

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, [appliedFilters, logout, navigate, page, retryCount]);

  function handleFilterChange(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    setPage(1);
    setAppliedFilters({
      customerId: filters.customerId.trim(),
      orderId: filters.orderId.trim(),
      paymentId: filters.paymentId.trim(),
      eventType: filters.eventType,
      sortOrder: filters.sortOrder,
    });
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const hasPreviousPage = Boolean(pagination && pagination.page > 1);

  const hasNextPage = Boolean(
    pagination &&
    pagination.totalPages > 0 &&
    pagination.page < pagination.totalPages,
  );

  return (
    <section className="staff-loyalty-page">
      <header className="staff-loyalty-page__heading">
        <h1>Loyalty Monitoring</h1>
        <p>Review backend-confirmed customer loyalty activity.</p>
      </header>

      <section
        className="staff-loyalty-card"
        aria-labelledby="loyalty-monitoring-title"
      >
        <header className="staff-loyalty-card__header">
          <div>
            <h2 id="loyalty-monitoring-title">Loyalty Transactions</h2>
            <p>
              Read-only loyalty history from the authoritative backend service.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => setRetryCount((current) => current + 1)}
          >
            Refresh
          </button>
        </header>

        <form className="staff-loyalty-filters" onSubmit={handleSubmit}>
          <div className="staff-loyalty-filters__grid">
            <label>
              Customer ID
              <input
                name="customerId"
                type="text"
                value={filters.customerId}
                onChange={handleFilterChange}
                placeholder="24-character customer ID"
              />
            </label>

            <label>
              Order ID
              <input
                name="orderId"
                type="text"
                value={filters.orderId}
                onChange={handleFilterChange}
                placeholder="24-character order ID"
              />
            </label>

            <label>
              Payment ID
              <input
                name="paymentId"
                type="text"
                value={filters.paymentId}
                onChange={handleFilterChange}
                placeholder="24-character payment ID"
              />
            </label>

            <label>
              Event type
              <select
                name="eventType"
                value={filters.eventType}
                onChange={handleFilterChange}
              >
                <option value="">All events</option>

                {LOYALTY_EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {EVENT_LABELS[eventType] || eventType}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sort order
              <select
                name="sortOrder"
                value={filters.sortOrder}
                onChange={handleFilterChange}
              >
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>
          </div>

          <div className="staff-loyalty-filters__actions">
            <button type="submit" disabled={loading}>
              Apply Filters
            </button>

            <button
              type="button"
              className="staff-loyalty-button--secondary"
              disabled={loading}
              onClick={handleClearFilters}
            >
              Clear
            </button>
          </div>
        </form>

        {loading ? (
          <p className="staff-loyalty-state" role="status">
            Loading loyalty activity...
          </p>
        ) : errorMessage ? (
          <div className="staff-loyalty-state" role="alert">
            <p>{errorMessage}</p>

            <button
              type="button"
              onClick={() => setRetryCount((current) => current + 1)}
            >
              Try Again
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <p className="staff-loyalty-state" role="status">
            No loyalty transactions found.
          </p>
        ) : (
          <>
            <div className="staff-loyalty-table-wrapper">
              <table className="staff-loyalty-table">
                <caption className="staff-loyalty-table__caption">
                  Customer loyalty transaction monitoring
                </caption>

                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col">Points Change</th>
                    <th scope="col">Balance After</th>
                    <th scope="col">Customer</th>
                    <th scope="col">Order</th>
                    <th scope="col">Payment</th>
                    <th scope="col">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <span className="staff-loyalty-event">
                          {EVENT_LABELS[transaction.type] || 'Loyalty Update'}
                        </span>
                      </td>

                      <td>{transaction.pointsDelta}</td>
                      <td>{transaction.balanceAfter}</td>
                      <td>{transaction.customerId}</td>
                      <td>{transaction.orderId}</td>
                      <td>{transaction.paymentId}</td>
                      <td>{formatDate(transaction.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination ? (
              <footer className="staff-loyalty-pagination">
                <span>
                  {pagination.total}{' '}
                  {pagination.total === 1 ? 'record' : 'records'}
                </span>

                {pagination.totalPages > 1 ? (
                  <nav aria-label="Loyalty monitoring pages">
                    <button
                      type="button"
                      disabled={!hasPreviousPage || loading}
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                    >
                      Previous
                    </button>

                    <span>
                      Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={!hasNextPage || loading}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </button>
                  </nav>
                ) : null}
              </footer>
            ) : null}
          </>
        )}
      </section>
    </section>
  );
}
