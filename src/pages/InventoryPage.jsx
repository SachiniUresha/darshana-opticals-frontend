import { useEffect, useState } from 'react';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useBranches } from '../hooks/useBranches';
import BranchSelect from '../components/common/BranchSelect';
import { BRANCH_MANAGER } from '../config/roles';
import { getBranchInventory } from '../services/inventoryService';
import './InventoryPage.css';

const money = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});

function InventoryImage({ item }) {
  const [failed, setFailed] = useState(false);
  const url = item.imageUrl;

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (
    !url ||
    typeof url !== 'string' ||
    !url.startsWith('https://') ||
    failed
  ) {
    return <span className="inventory-page__image-placeholder">No image</span>;
  }

  return (
    <img
      src={url}
      alt={item.itemName ? `${item.itemName} inventory item` : 'Inventory item'}
      onError={() => setFailed(true)}
      className="inventory-page__image"
    />
  );
}

function InventoryPage() {
  useDocumentTitle('Inventory Management | Darshana Opticals');
  const { user } = useAuth();
  const manager = user?.role === BRANCH_MANAGER;
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    retry: retryBranches,
    unauthorized: branchesUnauthorized,
  } = useBranches();

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  // Manager scope comes from login identity; never allow a manager to select a different branch.
  const branchId = manager ? user?.branchId || '' : selectedBranchId;
  const branch = branches.find((entry) => entry.id === branchId);
  const canLoad = Boolean(
    !branchesLoading && !branchesError && !branchesUnauthorized && branch,
  );

  useEffect(() => {
    if (!canLoad) {
      setItems([]);
      setError('');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setItems([]);
    setError('');

    getBranchInventory(branchId)
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((caught) => {
        if (!active) return;
        if (caught?.status === 401) {
          setError('Your session has expired. Please log in again.');
        } else if (caught?.status === 403) {
          setError(
            'You do not have permission to view inventory for this branch.',
          );
        } else {
          setError('Unable to load inventory. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [branchId, canLoad, refreshCount]);

  return (
    <div className="inventory-page">
      <header className="inventory-page__header">
        <div>
          <p className="inventory-page__eyebrow">INVENTORY</p>
          <h1>Inventory Management</h1>
          <p>View up-to-date inventory for an authorized branch.</p>
        </div>
        <button
          type="button"
          className="inventory-page__refresh"
          onClick={() => setRefreshCount((count) => count + 1)}
          disabled={!canLoad || loading}
        >
          Refresh
        </button>
      </header>

      <section className="inventory-page__panel" aria-label="Branch inventory">
        {manager ? (
          <div className="inventory-page__branch">
            <strong>Assigned branch</strong>
            {branchesLoading ? (
              <p role="status">Loading branch...</p>
            ) : branchesUnauthorized ? (
              <p role="alert">Your session has expired. Please log in again.</p>
            ) : branchesError ? (
              <div role="alert">
                <p>{branchesError}</p>
                <button type="button" onClick={retryBranches}>
                  Retry
                </button>
              </div>
            ) : (
              <p>{branch?.address || 'Assigned branch is unavailable.'}</p>
            )}
          </div>
        ) : (
          <BranchSelect
            id="inventory-branch"
            label="Branch"
            branches={branches}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
            loading={branchesLoading}
            error={branchesError}
            onRetry={retryBranches}
          />
        )}

        {branchesUnauthorized ? (
          !manager && (
            <p role="alert">Your session has expired. Please log in again.</p>
          )
        ) : !canLoad ? (
          !branchesLoading &&
          !branchesError && (
            <p className="inventory-page__notice">
              {manager && !branchId
                ? 'No assigned branch is available for this account.'
                : manager && !branch
                  ? 'Your assigned branch could not be found.'
                  : 'Select a branch to view its inventory.'}
            </p>
          )
        ) : loading ? (
          <p role="status" className="inventory-page__notice">
            Loading inventory...
          </p>
        ) : error ? (
          <div
            role="alert"
            className="inventory-page__notice inventory-page__notice--error"
          >
            <p>{error}</p>
            {error !== 'Your session has expired. Please log in again.' &&
              !error.startsWith('You do not have permission') && (
                <button
                  type="button"
                  onClick={() => setRefreshCount((count) => count + 1)}
                >
                  Try Again
                </button>
              )}
          </div>
        ) : items.length === 0 ? (
          <p className="inventory-page__notice">
            No inventory items found for this branch.
          </p>
        ) : (
          <div className="inventory-page__table-wrap">
            <table className="inventory-page__table">
              <caption>
                {items.length} inventory items — {branch?.address}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Image</th>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Brand</th>
                  <th scope="col">Price</th>
                  <th scope="col">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item._id || item.id || index}>
                    <td>
                      <InventoryImage item={item} />
                    </td>
                    <td>{item.itemName || 'Unnamed item'}</td>
                    <td>{item.category || '—'}</td>
                    <td>{item.brand || '—'}</td>
                    <td>
                      {typeof item.price === 'number'
                        ? money.format(item.price)
                        : '—'}
                    </td>
                    <td>
                      {typeof item.quantity === 'number' ? item.quantity : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default InventoryPage;
