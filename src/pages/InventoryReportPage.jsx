import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BranchSelect from '../components/common/BranchSelect';
import useAuth from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { BRANCH_MANAGER, SYSTEM_ADMIN } from '../config/roles';
import { getInventoryReport } from '../services/reportService';
import ReportBreakdown from '../components/reports/ReportBreakdown';
import ReportDetails from '../components/reports/ReportDetails';
import './InventoryReportPage.css';

const GROUP_OPTIONS = [
  { value: 'branch', label: 'By branch' },
  { value: 'category', label: 'By category' },
];
const STOCK_OPTIONS = [
  { value: '', label: 'All stock statuses' },
  { value: 'OK', label: 'In stock' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'REORDER_TRIGGERED', label: 'Reorder triggered' },
];
const INITIAL_FILTERS = {
  branchId: '',
  category: '',
  reorderStatus: '',
  groupBy: 'branch',
};
const METRICS = [
  { key: 'totalStockOnHand', label: 'Total stock on hand', kind: 'count' },
  {
    key: 'totalRetailValuation',
    adminOnly: true,
    label: 'Retail inventory valuation',
    kind: 'currency',
  },
  { key: 'totalUniqueProducts', label: 'Unique products', kind: 'count' },
  { key: 'lowStockCount', label: 'Low-stock items', kind: 'count' },
  {
    key: 'reorderTriggeredCount',
    label: 'Reorder-triggered items',
    kind: 'count',
  },
  { key: 'okStockCount', label: 'Items with OK status', kind: 'count' },
];
const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const integer = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });

function metric(value, kind) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return 'Unavailable';
  return kind === 'currency' ? currency.format(value) : integer.format(value);
}

function safeError(caught) {
  if (caught?.status === 403)
    return 'You do not have permission to view inventory reports.';
  if (caught?.status === 400 || caught?.status === 422) {
    return 'The inventory report filters were rejected. Check your selections and try again.';
  }
  return 'Unable to load the inventory report. Please try again.';
}

export default function InventoryReportPage() {
  useDocumentTitle('Inventory Reporting | Darshana Opticals');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const admin = user?.role === SYSTEM_ADMIN;
  const manager = user?.role === BRANCH_MANAGER;
  const {
    branches,
    loading: branchesLoading,
    error: branchesError,
    retry: retryBranches,
    unauthorized: branchesUnauthorized,
  } = useBranches();
  const [draft, setDraft] = useState(INITIAL_FILTERS);
  const [applied, setApplied] = useState(INITIAL_FILTERS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Prevent a previously authorized report from being displayed after a role/branch change.
  const scopeKey = `${user?.role || ''}:${user?.branchId || ''}:${admin ? applied.branchId : ''}`;
  const report = result?.scopeKey === scopeKey ? result.value : null;
  const safeReportError = error?.scopeKey === scopeKey ? error.message : '';

  useEffect(() => {
    if (branchesUnauthorized) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [branchesUnauthorized, logout, navigate]);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError(null);
    setLoading(true);

    // Manager requests omit branchId; backend enforces their assigned branch.
    const filters = {
      groupBy: applied.groupBy,
      ...(applied.category ? { category: applied.category } : {}),
      ...(applied.reorderStatus
        ? { reorderStatus: applied.reorderStatus }
        : {}),
      ...(admin && applied.branchId ? { branchId: applied.branchId } : {}),
    };

    getInventoryReport(filters)
      .then((value) => {
        if (active) setResult({ scopeKey, value });
      })
      .catch((caught) => {
        if (!active) return;
        if (caught?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setError({ scopeKey, message: safeError(caught) });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [admin, applied, logout, navigate, retryCount, scopeKey]);

  function changeFilter(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    if (loading) return;
    setApplied({
      ...draft,
      category: draft.category.trim(),
      branchId: admin ? draft.branchId : '',
    });
  }

  const snapshotDate =
    report?.snapshotTimestamp &&
    !Number.isNaN(Date.parse(report.snapshotTimestamp))
      ? new Date(report.snapshotTimestamp).toLocaleString('en-GB', {
          timeZone: 'Asia/Colombo',
        })
      : null;

  return (
    <div className="inventory-report-page">
      <header className="inventory-report-page__header">
        <p className="inventory-report-page__eyebrow">BUSINESS REPORTING</p>
        <h1>Inventory Reports</h1>
        <p>
          Live stock snapshot supplied by the reporting service. Historical
          inventory is not inferred.
        </p>
      </header>

      <section
        className="inventory-report-page__panel"
        aria-labelledby="inventory-report-filters"
      >
        <h2 id="inventory-report-filters">Report filters</h2>
        <form
          className="inventory-report-page__filters"
          onSubmit={applyFilters}
        >
          <label>
            Group results by
            <select
              value={draft.groupBy}
              onChange={(event) => changeFilter('groupBy', event.target.value)}
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <input
              type="text"
              value={draft.category}
              maxLength={80}
              placeholder="All categories"
              onChange={(event) => changeFilter('category', event.target.value)}
            />
          </label>
          <label>
            Stock status
            <select
              value={draft.reorderStatus}
              onChange={(event) =>
                changeFilter('reorderStatus', event.target.value)
              }
            >
              {STOCK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {admin && (
            <BranchSelect
              id="inventory-report-branch"
              label="Branch"
              branches={branches}
              loading={branchesLoading}
              error={branchesError}
              onRetry={retryBranches}
              value={draft.branchId}
              onChange={(value) => changeFilter('branchId', value)}
              placeholder="All branches"
            />
          )}
          {manager && (
            <p className="inventory-report-page__scope">
              Scope: Your assigned branch
            </p>
          )}
          <button type="submit" disabled={loading || branchesUnauthorized}>
            Apply filters
          </button>
        </form>
      </section>

      <section
        className="inventory-report-page__panel"
        aria-labelledby="inventory-report-summary"
      >
        <div className="inventory-report-page__section-heading">
          <div>
            <h2 id="inventory-report-summary">Current inventory snapshot</h2>
            {report && (
              <p className="inventory-report-page__timestamp">
                {snapshotDate
                  ? `As of ${snapshotDate} (Asia/Colombo)`
                  : 'Snapshot time unavailable'}
                {' | '}
                {report.currency || 'LKR'}
              </p>
            )}
          </div>
          {!loading &&
            safeReportError &&
            safeReportError !==
              'You do not have permission to view inventory reports.' && (
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                Try again
              </button>
            )}
        </div>
        {loading ? (
          <p role="status">Loading inventory report...</p>
        ) : safeReportError ? (
          <p role="alert" className="inventory-report-page__error">
            {safeReportError}
          </p>
        ) : report ? (
          <>
            <dl className="inventory-report-page__metrics">
              {METRICS.filter(({ adminOnly }) => admin || !adminOnly).map(
                ({ key, label, kind }) => (
                  <div className="inventory-report-page__metric" key={key}>
                    <dt>{label}</dt>
                    <dd>{metric(report.summary?.[key], kind)}</dd>
                  </div>
                ),
              )}
            </dl>
            {report.summary?.totalUniqueProducts === 0 && (
              <p role="status" className="inventory-report-page__empty">
                No inventory items match the selected filters.
              </p>
            )}
            {report.reorderThresholdUsed != null && (
              <p className="inventory-report-page__hint">
                Reporting threshold:{' '}
                {metric(report.reorderThresholdUsed, 'count')}
              </p>
            )}
          </>
        ) : (
          <p role="status">No inventory report is available.</p>
        )}
      </section>
      {!loading && !safeReportError && report && (
        <>
          <ReportBreakdown
            kind="inventory"
            groupBy={applied.groupBy}
            breakdowns={report.breakdowns}
          />
          <ReportDetails
            key={`${scopeKey}:${JSON.stringify(applied)}`}
            kind="inventory"
            applied={applied}
            admin={admin}
            scopeId={scopeKey}
          />
        </>
      )}
    </div>
  );
}
