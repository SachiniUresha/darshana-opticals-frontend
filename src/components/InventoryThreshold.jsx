import { useEffect, useState } from 'react';
import {
  getGlobalReorderThreshold,
  updateGlobalReorderThreshold,
} from '../services/inventoryService';
import './InventoryThreshold.css';

function safeMessage(error, action) {
  if (error?.status === 401) {
    return 'Your session has expired. Please log in again.';
  }
  if (error?.status === 403) {
    return 'You do not have permission to manage the reorder threshold.';
  }
  if (error?.code === 'THRESHOLD_UPDATE_UNAVAILABLE') {
    return 'Reorder threshold update is currently unavailable. Please try again later.';
  }
  if (action === 'update' && (error?.status === 400 || error?.status === 422)) {
    return 'Enter a valid non-negative reorder threshold.';
  }
  return action === 'load'
    ? 'Unable to load reorder threshold. Please try again.'
    : 'Unable to update reorder threshold. Please try again.';
}

function InventoryThreshold({ onUpdated }) {
  const [threshold, setThreshold] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');

    getGlobalReorderThreshold()
      .then((value) => {
        if (!active) return;
        setThreshold(value);
        setDraft(String(value));
      })
      .catch((caught) => {
        if (!active) return;
        setThreshold(null);
        setDraft('');
        setError(safeMessage(caught, 'load'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retryCount]);

  async function submit(event) {
    event.preventDefault();
    if (saving || loading || threshold === null) return;

    const input = draft.trim();
    const value = Number(input);
    if (
      !/^\d+(?:\.\d+)?$/.test(input) ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      setValidationError('Enter a valid non-negative reorder threshold.');
      return;
    }

    if (value === threshold) return;

    setSaving(true);
    setError('');
    setNotice('');
    setValidationError('');
    try {
      const confirmedThreshold = await updateGlobalReorderThreshold(value);
      setThreshold(confirmedThreshold);
      setDraft(String(confirmedThreshold));
      setNotice('Global reorder threshold updated.');
      onUpdated?.();
    } catch (caught) {
      setError(safeMessage(caught, 'update'));
    } finally {
      setSaving(false);
    }
  }

  const canRetry =
    error &&
    !error.startsWith('Your session') &&
    !error.startsWith('You do not');

  return (
    <section
      className="inventory-page__panel inventory-threshold"
      aria-labelledby="inventory-threshold-heading"
    >
      <h2 id="inventory-threshold-heading">Global Reorder Threshold</h2>
      <p>
        Changes apply to all branches. The backend updates affected reorder
        alerts.
      </p>

      {loading ? (
        <p role="status">Loading reorder threshold...</p>
      ) : threshold === null ? (
        <div role="alert">
          <p>{error || 'Reorder threshold is unavailable.'}</p>
          {canRetry && (
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Try Again
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="inventory-threshold__current">
            Current threshold: <strong>{threshold}</strong>
          </p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="inventory-threshold-input">
              New global threshold
            </label>
            <div className="inventory-threshold__controls">
              <input
                id="inventory-threshold-input"
                type="number"
                min="0"
                step="any"
                required
                value={draft}
                disabled={saving}
                aria-invalid={Boolean(validationError)}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setValidationError('');
                  setNotice('');
                }}
              />
              <button
                type="submit"
                disabled={saving || draft.trim() === String(threshold)}
              >
                {saving ? 'Updating...' : 'Update Threshold'}
              </button>
            </div>
          </form>
          {validationError && <p role="alert">{validationError}</p>}
          {error && <p role="alert">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </>
      )}
    </section>
  );
}

export default InventoryThreshold;
