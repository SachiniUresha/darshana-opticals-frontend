import { useEffect, useState } from 'react';
import useAuth from '../hooks/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useBranches } from '../hooks/useBranches';
import BranchSelect from '../components/common/BranchSelect';
import { BRANCH_MANAGER, SYSTEM_ADMIN } from '../config/roles';
import {
  getBranchInventory,
  createInventoryItem,
  uploadInventoryImage,
  replaceInventoryImage,
  removeInventoryImage,
  updateInventoryItem,
  overrideInventoryPrice,
  updateInventoryQuantity,
} from '../services/inventoryService';
import InventoryEditor from '../components/InventoryEditor';
import InventoryQuantityEditor from '../components/InventoryQuantityEditor';
import InventoryReorderAlerts from '../components/InventoryReorderAlerts';
import InventoryThreshold from '../components/InventoryThreshold';
import InventoryImageManager from '../components/InventoryImageManager';
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
  const admin = user?.role === SYSTEM_ADMIN;
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
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');

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

  function selectBranch(id) {
    if (saving) return;
    setEditor(null);
    setSaveError('');
    setSaveNotice('');
    setSelectedBranchId(id);
  }

  function refresh() {
    if (saving) return;
    setEditor(null);
    setSaveError('');
    setSaveNotice('');
    setRefreshCount((count) => count + 1);
  }

  function openEditor(type, item = null) {
    setSaveError('');
    setSaveNotice('');
    setEditor({ type, item });
  }

  async function saveItem(values) {
    if (!editor || !canLoad || loading || error || saving) return;
    const { type, item } = editor;
    const itemId = item?._id || item?.id;

    setSaving(true);
    setSaveError('');
    let imageUploadPending = false;
    try {
      if (type === 'create' && manager) {
        let uploadedImage = null;
        if (values.imageFile) {
          imageUploadPending = true;
          setUploading(true);
          uploadedImage = await uploadInventoryImage(values.imageFile);
          imageUploadPending = false;
          setUploading(false);
        }
        if (uploadedImage) {
          await createInventoryItem(branchId, values, uploadedImage);
        } else {
          await createInventoryItem(branchId, values);
        }
      } else if (type === 'image' && manager && itemId && values.imageFile) {
        imageUploadPending = true;
        setUploading(true);
        const imageMetadata = await uploadInventoryImage(values.imageFile);
        imageUploadPending = false;
        setUploading(false);
        await replaceInventoryImage(itemId, imageMetadata);
      } else if (
        type === 'image' &&
        manager &&
        itemId &&
        values.remove === true
      ) {
        await removeInventoryImage(itemId);
      } else if (type === 'edit' && manager && itemId) {
        await updateInventoryItem(itemId, values);
      } else if (type === 'price' && admin && itemId) {
        await overrideInventoryPrice(itemId, values.price);
      } else if (type === 'quantity' && manager && itemId) {
        await updateInventoryQuantity(itemId, values.quantity);
      } else {
        setSaveError('This inventory action is not permitted.');
        return;
      }

      setEditor(null);
      setSaveNotice(
        type === 'create'
          ? 'Inventory item added.'
          : type === 'image'
            ? values.remove === true
              ? 'Inventory image removed.'
              : 'Inventory image updated.'
            : 'Inventory item updated.',
      );
      setRefreshCount((count) => count + 1);
    } catch (caught) {
      if (caught?.status === 401) {
        setSaveError('Your session has expired. Please log in again.');
      } else if (imageUploadPending && caught?.status === 403) {
        setSaveError(
          'You do not have permission to upload an inventory image.',
        );
      } else if (
        imageUploadPending &&
        [400, 413, 422].includes(caught?.status)
      ) {
        setSaveError(
          'The image was rejected. Select a JPG, PNG or WebP image up to 5 MB.',
        );
      } else if (imageUploadPending) {
        setSaveError('Unable to upload inventory image. Please try again.');
      } else if (caught?.status === 403) {
        setSaveError(
          'You do not have permission to change this inventory item.',
        );
      } else if (caught?.status === 422 || caught?.status === 400) {
        setSaveError('Check the item information and try again.');
      } else {
        setSaveError('Unable to save inventory changes. Please try again.');
      }
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  return (
    <div className="inventory-page">
      <header className="inventory-page__header">
        <div>
          <p className="inventory-page__eyebrow">INVENTORY</p>
          <h1>Inventory Management</h1>
          <p>View up-to-date inventory for an authorized branch.</p>
        </div>
        <div className="inventory-page__header-actions">
          {manager && canLoad && !error && (
            <button
              type="button"
              onClick={() => openEditor('create')}
              disabled={loading || saving}
            >
              Add Inventory Item
            </button>
          )}
          <button
            type="button"
            className="inventory-page__refresh"
            onClick={refresh}
            disabled={!canLoad || loading || saving}
          >
            Refresh
          </button>
        </div>
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
            onChange={selectBranch}
            disabled={saving}
            loading={branchesLoading}
            error={branchesError}
            onRetry={retryBranches}
          />
        )}

        {saveNotice && (
          <p role="status" className="inventory-page__save-notice">
            {saveNotice}
          </p>
        )}

        {editor &&
          editor.type !== 'quantity' &&
          editor.type !== 'image' &&
          canLoad &&
          !loading &&
          !error && (
            <InventoryEditor
              key={`${editor.type}-${editor.item?._id || editor.item?.id || 'new'}`}
              mode={editor.type}
              item={editor.item}
              saving={saving}
              error={saveError}
              onCancel={() => {
                setEditor(null);
                setSaveError('');
              }}
              onSave={saveItem}
            />
          )}

        {editor?.type === 'image' &&
          manager &&
          canLoad &&
          !loading &&
          !error && (
            <InventoryImageManager
              key={editor.item?._id || editor.item?.id}
              item={editor.item}
              saving={saving}
              uploading={uploading}
              error={saveError}
              onCancel={() => {
                setEditor(null);
                setSaveError('');
              }}
              onReplace={(imageFile) => saveItem({ imageFile })}
              onRemove={() => saveItem({ remove: true })}
            />
          )}

        {editor?.type === 'quantity' && canLoad && !loading && !error && (
          <InventoryQuantityEditor
            key={editor.item?._id || editor.item?.id}
            item={editor.item}
            saving={saving}
            uploading={uploading}
            error={saveError}
            onCancel={() => {
              setEditor(null);
              setSaveError('');
            }}
            onSave={saveItem}
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
                  <th scope="col">Actions</th>
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
                    <td>
                      {(manager || admin) && (item._id || item.id) && (
                        <button
                          type="button"
                          className="inventory-page__item-action"
                          onClick={() =>
                            openEditor(manager ? 'edit' : 'price', item)
                          }
                          disabled={saving}
                          aria-label={`${manager ? 'Edit' : 'Edit price for'} ${item.itemName || 'inventory item'}`}
                        >
                          {manager ? 'Edit' : 'Edit Price'}
                        </button>
                      )}
                      {manager && (item._id || item.id) && (
                        <button
                          type="button"
                          className="inventory-page__item-action"
                          onClick={() => openEditor('image', item)}
                          disabled={saving}
                          aria-label={`Manage image for ${item.itemName || 'inventory item'}`}
                        >
                          Image
                        </button>
                      )}
                      {manager && (item._id || item.id) && (
                        <button
                          type="button"
                          className="inventory-page__item-action inventory-page__item-action--quantity"
                          onClick={() => openEditor('quantity', item)}
                          disabled={saving}
                          aria-label={`Update quantity for ${item.itemName || 'inventory item'}`}
                        >
                          Update Stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {canLoad && !loading && !error && (
        <InventoryReorderAlerts
          key={branchId}
          branchId={branchId}
          refreshCount={refreshCount}
        />
      )}
      {(manager || admin) && (
        <InventoryThreshold
          onUpdated={() => setRefreshCount((count) => count + 1)}
        />
      )}
    </div>
  );
}

export default InventoryPage;
