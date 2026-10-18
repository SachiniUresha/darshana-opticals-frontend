import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BranchSelect from '../components/common/BranchSelect';
import useAuth from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { BRANCH_MANAGER, SYSTEM_ADMIN } from '../config/roles';
import { getSalesReport } from '../services/reportService';
import './SalesReportPage.css';

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
];

const GROUPINGS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'branch', label: 'By branch' },
  { value: 'category', label: 'By category' },
];

const INITIAL_FILTERS = {
  preset: 'last_30_days',
  startDate: '',
  endDate: '',
  branchId: '',
  groupBy: 'day',
};

const METRICS = [
  { key: 'grossRevenue', label: 'Gross revenue', kind: 'currency' },
  { key: 'refundDeductions', label: 'Refund deductions', kind: 'currency' },
  { key: 'netRevenue', label: 'Net revenue', kind: 'currency' },
  { key: 'totalOrders', label: 'Qualifying orders', kind: 'count' },
  { key: 'averageOrderValue', label: 'Average order value', kind: 'currency' },
  { key: 'itemsSold', label: 'Items sold', kind: 'count' },
  { key: 'cancelledOrdersCount', label: 'Cancelled orders', kind: 'count' },
  {
    key: 'cancelledOrdersValue',
    label: 'Cancelled order value',
    kind: 'currency',
  },
];

const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const integer = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });

function formatMetric(value, kind) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '\u2014';
  return kind === 'currency' ? currency.format(value) : integer.format(value);
}

function validateFilters(filters) {
  if (filters.preset !== 'custom') return '';
  if (!filters.startDate || !filters.endDate) {
    return 'Select both start and end dates.';
  }
  if (filters.startDate > filters.endDate) {
    return 'Start date must not be after end date.';
  }
  const first = Date.parse(`${filters.startDate}T00:00:00Z`);
  const last = Date.parse(`${filters.endDate}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return 'Select valid reporting dates.';
  }
  if ((last - first) / 86400000 > 365) {
    return 'Custom date range must not exceed 365 days.';
  }
  return '';
}

function safeError(error) {
  if (error?.status === 403)
    return 'You do not have permission to view sales reports.';
  if (error?.status === 400 || error?.status === 422) {
    return 'The report filters were rejected. Check the dates and try again.';
  }
  return 'Unable to load the sales report. Please try again.';
}

export default function SalesReportPage() {
  useDocumentTitle('Sales Reporting | Darshana Opticals');
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
  const [validationError, setValidationError] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (branchesUnauthorized) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [branchesUnauthorized, logout, navigate]);

  useEffect(() => {
    let active = true;
    setReport(null);
    setError('');
    setLoading(true);

    // Managers never choose or submit another branch. The backend enforces scope.
    const filters = {
      preset: applied.preset,
      groupBy: applied.groupBy,
      ...(applied.preset === 'custom'
        ? { startDate: applied.startDate, endDate: applied.endDate }
        : {}),
      ...(admin && applied.branchId ? { branchId: applied.branchId } : {}),
    };

    getSalesReport(filters)
      .then((result) => {
        if (active) setReport(result);
      })
      .catch((caught) => {
        if (!active) return;
        if (caught?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setError(safeError(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [admin, applied, logout, navigate, retry, user?.role, user?.branchId]);

  function changeFilter(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
    setValidationError('');
  }

  function applyFilters(event) {
    event.preventDefault();
    const validation = validateFilters(draft);
    if (validation) {
      setValidationError(validation);
      return;
    }
    if (loading) return;
    setApplied({ ...draft, branchId: admin ? draft.branchId : '' });
  }

  return (
    <div className="sales-report-page">
      <header className="sales-report-page__header">
        <p className="sales-report-page__eyebrow">BUSINESS REPORTING</p>
        <h1>Sales Reports</h1>
        <p>
          Verified payment-based sales figures supplied by the reporting
          service.
        </p>
      </header>

      <section
        className="sales-report-page__panel"
        aria-labelledby="sales-report-filters"
      >
        <h2 id="sales-report-filters">Report filters</h2>
        <form
          onSubmit={applyFilters}
          className="sales-report-page__filters"
          noValidate
        >
          <label>
            Date range
            <select
              value={draft.preset}
              onChange={(event) => changeFilter('preset', event.target.value)}
            >
              {PRESETS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {draft.preset === 'custom' && (
            <>
              <label>
                Start date
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) =>
                    changeFilter('startDate', event.target.value)
                  }
                  required
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(event) =>
                    changeFilter('endDate', event.target.value)
                  }
                  required
                />
              </label>
            </>
          )}
          <label>
            Group results by
            <select
              value={draft.groupBy}
              onChange={(event) => changeFilter('groupBy', event.target.value)}
            >
              {GROUPINGS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {admin && (
            <BranchSelect
              id="sales-report-branch"
              label="Branch"
              branches={branches}
              value={draft.branchId}
              onChange={(value) => changeFilter('branchId', value)}
              loading={branchesLoading}
              error={branchesError}
              onRetry={retryBranches}
              placeholder="All branches"
            />
          )}
          {manager && (
            <p className="sales-report-page__scope">
              Scope: Your assigned branch
            </p>
          )}
          <button type="submit" disabled={loading || branchesUnauthorized}>
            Apply filters
          </button>
        </form>
        {validationError && (
          <p role="alert" className="sales-report-page__error">
            {validationError}
          </p>
        )}
      </section>

      <section
        className="sales-report-page__panel"
        aria-labelledby="sales-report-summary"
      >
        <div className="sales-report-page__section-heading">
          <div>
            <h2 id="sales-report-summary">Sales summary</h2>
            {report && (
              <p className="sales-report-page__period">
                {report.dateRange?.startDate} to {report.dateRange?.endDate}{' '}
                &middot; {report.timezone || 'Asia/Colombo'} &middot;{' '}
                {report.currency || 'LKR'}
              </p>
            )}
          </div>
          {!loading && error && (
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </div>
        {loading ? (
          <p role="status">Loading sales report...</p>
        ) : error ? (
          <p role="alert" className="sales-report-page__error">
            {error}
          </p>
        ) : report ? (
          <>
            <dl className="sales-report-page__metrics">
              {METRICS.map(({ key, label, kind }) => (
                <div className="sales-report-page__metric" key={key}>
                  <dt>{label}</dt>
                  <dd>{formatMetric(report.summary?.[key], kind)}</dd>
                </div>
              ))}
            </dl>
            {report.summary?.totalOrders === 0 && (
              <p className="sales-report-page__empty" role="status">
                No qualifying sales for the selected filters.
              </p>
            )}
          </>
        ) : (
          <p role="status">No sales report is available.</p>
        )}
      </section>
    </div>
  );
}
