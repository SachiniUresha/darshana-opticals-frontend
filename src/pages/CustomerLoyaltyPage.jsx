import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { getOwnLoyalty } from '../services/loyaltyService';
import './CustomerLoyaltyPage.css';

const PAGE_SIZE = 25;

const EVENT_LABELS = {
  EARN_PURCHASE: 'Points earned',
  REFUND_REVERSAL: 'Points reversed',
  REDEMPTION_DEDUCTION: 'Points deducted',
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
    return 'You do not have permission to view this loyalty information.';
  }

  if (error?.status === 404) {
    return 'Your customer loyalty account could not be found.';
  }

  if (error?.status === 409) {
    return 'Your loyalty account needs to be updated before it can be displayed. Please contact support.';
  }

  return 'Unable to load your loyalty information. Please try again.';
}

function CustomerLoyaltyPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [loyalty, setLoyalty] = useState(null);
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'My Loyalty | Darshana Opticals';

    let active = true;

    async function loadLoyalty() {
      setLoading(true);
      setErrorMessage('');

      try {
        const result = await getOwnLoyalty({
          page,
          limit: PAGE_SIZE,
        });

        if (active) {
          setLoyalty(result);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        if (error?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }

        setLoyalty(null);
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
  }, [logout, navigate, page, retryCount]);

  const pagination = loyalty?.pagination;
  const hasPreviousPage = Boolean(pagination && pagination.page > 1);
  const hasNextPage = Boolean(
    pagination &&
    pagination.totalPages > 0 &&
    pagination.page < pagination.totalPages,
  );

  return (
    <main className="loyalty-page">
      <Link className="loyalty-page__back" to="/profile">
        &larr; Back to My Profile
      </Link>

      <header className="loyalty-page__header">
        <p className="loyalty-page__eyebrow">Customer Loyalty</p>
        <h1>My Loyalty</h1>
        <p>View your current loyalty balance and confirmed loyalty activity.</p>
      </header>

      {loading ? (
        <div className="loyalty-page__state" role="status" aria-live="polite">
          <span className="loyalty-page__spinner" aria-hidden="true" />
          <p>Loading your loyalty information...</p>
        </div>
      ) : errorMessage ? (
        <div
          className="loyalty-page__state loyalty-page__state--error"
          role="alert"
        >
          <p>{errorMessage}</p>

          <button
            type="button"
            onClick={() => setRetryCount((current) => current + 1)}
          >
            Try Again
          </button>
        </div>
      ) : loyalty ? (
        <>
          <section
            className="loyalty-balance-card"
            aria-labelledby="loyalty-balance-title"
          >
            <div>
              <p
                className="loyalty-balance-card__label"
                id="loyalty-balance-title"
              >
                Current loyalty balance
              </p>

              <div className="loyalty-balance-card__value">
                <strong>{loyalty.balance}</strong>
                <span>points</span>
              </div>
            </div>

            <p className="loyalty-balance-card__note">
              Your balance is provided by Darshana Opticals.
            </p>
          </section>

          <section
            className="loyalty-history"
            aria-labelledby="loyalty-history-title"
          >
            <header className="loyalty-history__header">
              <div>
                <h2 id="loyalty-history-title">Loyalty History</h2>
                <p>Confirmed loyalty activity associated with your account.</p>
              </div>

              {pagination ? (
                <span className="loyalty-history__count">
                  {pagination.total}{' '}
                  {pagination.total === 1 ? 'record' : 'records'}
                </span>
              ) : null}
            </header>

            {loyalty.transactions.length === 0 ? (
              <div className="loyalty-history__empty" role="status">
                <h3>No loyalty activity yet</h3>
                <p>
                  Confirmed loyalty activity will appear here when available.
                </p>
              </div>
            ) : (
              <ul className="loyalty-history__list">
                {loyalty.transactions.map((transaction) => (
                  <li key={transaction.id} className="loyalty-history__item">
                    <div className="loyalty-history__event">
                      <strong>
                        {EVENT_LABELS[transaction.type] || 'Loyalty update'}
                      </strong>
                      <span>{formatDate(transaction.createdAt)}</span>
                    </div>

                    <dl className="loyalty-history__details">
                      <div>
                        <dt>Points change</dt>
                        <dd>{transaction.pointsDelta} points</dd>
                      </div>

                      <div>
                        <dt>Balance after</dt>
                        <dd>{transaction.balanceAfter} points</dd>
                      </div>

                      <div>
                        <dt>Order reference</dt>
                        <dd>{transaction.orderId}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}

            {pagination && pagination.totalPages > 1 ? (
              <nav
                className="loyalty-pagination"
                aria-label="Loyalty history pages"
              >
                <button
                  type="button"
                  disabled={!hasPreviousPage}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>

                <span>
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  disabled={!hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}

export default CustomerLoyaltyPage;
