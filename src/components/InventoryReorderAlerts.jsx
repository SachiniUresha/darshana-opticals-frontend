import { useEffect, useState } from 'react';
import { getActiveReorderAlerts } from '../services/inventoryService';

const PAGE_SIZE = 20;

function safeDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB');
}

function InventoryReorderAlerts({ branchId, refreshCount }) {
  const [page, setPage] = useState(1);
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setAlerts([]);

    getActiveReorderAlerts(branchId, page)
      .then((result) => {
        if (!active) return;
        // A stock change can resolve all alerts on the current page.
        // The next request must then use a page that still exists.
        const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setAlerts(result.alerts);
        setTotal(result.total);
      })
      .catch((caught) => {
        if (!active) return;
        setTotal(0);
        if (caught?.status === 401) {
          setError('Your session has expired. Please log in again.');
        } else if (caught?.status === 403) {
          setError(
            'You do not have permission to view reorder alerts for this branch.',
          );
        } else {
          setError('Unable to load reorder alerts. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [branchId, page, refreshCount, retryCount]);

  const canRetry =
    error &&
    !error.startsWith('Your session') &&
    !error.startsWith('You do not');

  return (
    <section
      className="inventory-page__panel"
      aria-labelledby="inventory-alerts-heading"
    >
      <div className="inventory-page__alerts-header">
        <div>
          <h2 id="inventory-alerts-heading">Active Reorder Alerts</h2>
          <p>Low-stock alerts reported by the inventory system.</p>
        </div>
        {!loading && !error && <strong>{total} active</strong>}
      </div>

      {loading ? (
        <p role="status" className="inventory-page__notice">
          Loading reorder alerts...
        </p>
      ) : error ? (
        <div
          role="alert"
          className="inventory-page__notice inventory-page__notice--error"
        >
          <p>{error}</p>
          {canRetry && (
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Try Again
            </button>
          )}
        </div>
      ) : alerts.length === 0 ? (
        <p className="inventory-page__notice">
          No active reorder alerts for this branch.
        </p>
      ) : (
        <>
          <div className="inventory-page__table-wrap">
            <table className="inventory-page__table">
              <caption>Active backend reorder alerts</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Current Quantity</th>
                  <th scope="col">Threshold</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, index) => (
                  <tr key={alert._id || index}>
                    <td>
                      {alert.inventoryId?.itemName ||
                        'Inventory item unavailable'}
                    </td>
                    <td>{alert.branchId?.address || '—'}</td>
                    <td>
                      {typeof alert.currentQuantity === 'number'
                        ? alert.currentQuantity
                        : '—'}
                    </td>
                    <td>
                      {typeof alert.threshold === 'number'
                        ? alert.threshold
                        : '—'}
                    </td>
                    <td>{alert.status || '—'}</td>
                    <td>{safeDate(alert.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <nav
              className="inventory-page__alerts-pages"
              aria-label="Reorder alert pages"
            >
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <button
                type="button"
                disabled={page * PAGE_SIZE >= total}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default InventoryReorderAlerts;
