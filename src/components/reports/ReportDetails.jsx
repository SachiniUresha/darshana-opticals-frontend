import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import {
  getSalesOrders,
  getInventoryItems,
} from '../../services/reportService';
import { downloadReportExport } from '../../services/reportExportService';
import './ReportDetails.css';

const PAGE_SIZE = 20;
const SALES_SORTS = [
  { value: 'paidAt', label: 'Payment date' },
  { value: 'createdAt', label: 'Order date' },
  { value: 'totalAmount', label: 'Paid amount' },
  { value: 'quantity', label: 'Item count' },
];
const INVENTORY_SORTS = [
  { value: 'quantity', label: 'Quantity' },
  { value: 'unitPrice', label: 'Unit price' },
  { value: 'name', label: 'Item name' },
  { value: 'category', label: 'Category' },
  { value: 'sku', label: 'SKU' },
];
const STATUSES = ['PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'];
const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});

function money(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? currency.format(value)
    : 'Unavailable';
}
function display(value) {
  return typeof value === 'string' && value.trim() ? value : 'Unavailable';
}
function date(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Unavailable';
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' });
}
function safeError(error, operation) {
  if (error?.status === 403)
    return 'You do not have permission to access this report.';
  if (error?.status === 400 || error?.status === 422)
    return 'The report filters were rejected. Please review your selections.';
  return operation === 'export'
    ? 'Unable to download the report. Please try again.'
    : 'Unable to load report records. Please try again.';
}

function detailFilters(kind, applied, admin) {
  const scope = admin && applied.branchId ? { branchId: applied.branchId } : {};
  if (kind === 'sales') {
    return {
      preset: applied.preset,
      ...(applied.preset === 'custom'
        ? { startDate: applied.startDate, endDate: applied.endDate }
        : {}),
      ...scope,
    };
  }
  return {
    ...(applied.category ? { category: applied.category } : {}),
    ...(applied.reorderStatus ? { reorderStatus: applied.reorderStatus } : {}),
    ...scope,
  };
}

/** Shows only the backend's approved reporting DTO, not raw customer or clinical records. */
export default function ReportDetails({ kind, applied, admin, scopeId }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const sales = kind === 'sales';
  const sortOptions = sales ? SALES_SORTS : INVENTORY_SORTS;
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(sales ? 'paidAt' : 'quantity');
  const [sortOrder, setSortOrder] = useState('desc');
  const [orderStatus, setOrderStatus] = useState('');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');

  // Associate data with its exact role/branch/filter/sort combination.
  // An old response must never be rendered for a newly selected scope.
  const requestKey = JSON.stringify({
    kind,
    applied,
    admin,
    scopeId,
    page,
    sortBy,
    sortOrder,
    orderStatus,
    retry,
  });
  const data = result?.key === requestKey ? result.value : null;
  const error = errorState?.key === requestKey ? errorState.message : '';
  const pending =
    loading || (result?.key !== requestKey && errorState?.key !== requestKey);
  const baseFilters = detailFilters(kind, applied, admin);
  const pagination = data?.pagination;
  const rows = sales ? data?.orders : data?.items;

  useEffect(() => {
    let active = true;
    setResult(null);
    setErrorState(null);
    setLoading(true);
    setExportError('');
    const filters = {
      ...detailFilters(kind, applied, admin),
      page,
      limit: PAGE_SIZE,
      sortBy,
      sortOrder,
      ...(sales && orderStatus ? { orderStatus } : {}),
    };
    const loader = sales ? getSalesOrders : getInventoryItems;
    loader(filters)
      .then((value) => {
        if (active) setResult({ key: requestKey, value });
      })
      .catch((caught) => {
        if (!active) return;
        if (caught?.status === 401) {
          logout();
          navigate('/login', { replace: true });
          return;
        }
        setErrorState({ key: requestKey, message: safeError(caught, 'read') });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    kind,
    applied,
    admin,
    scopeId,
    page,
    sortBy,
    sortOrder,
    orderStatus,
    retry,
    requestKey,
    sales,
    logout,
    navigate,
  ]);

  async function exportReport(format) {
    if (exporting) return;
    setExportError('');
    setExporting(format);
    try {
      // The backend export contract does not accept table sort/orderStatus.
      // Send only approved period/branch or current snapshot filters.
      await downloadReportExport(kind, baseFilters, format);
    } catch (caught) {
      if (caught?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      setExportError(safeError(caught, 'export'));
    } finally {
      setExporting('');
    }
  }

  return (
    <section
      className="report-details"
      aria-label={sales ? 'Sales order details' : 'Inventory item details'}
    >
      <div className="report-details__header">
        <div>
          <h2>{sales ? 'Sales order details' : 'Inventory item details'}</h2>
          <p>
            Backend-provided records and pagination. No browser-calculated
            reporting totals.
          </p>
        </div>
        <div className="report-details__exports">
          <button
            type="button"
            disabled={Boolean(exporting) || pending}
            onClick={() => exportReport('csv')}
          >
            {exporting === 'csv' ? 'Preparing CSV...' : 'Export CSV'}
          </button>
          <button
            type="button"
            disabled={Boolean(exporting) || pending}
            onClick={() => exportReport('xlsx')}
          >
            {exporting === 'xlsx' ? 'Preparing Excel...' : 'Export Excel'}
          </button>
        </div>
      </div>
      {sales && (
        <p className="report-details__note">
          Exports include all qualifying statuses for the selected period and
          branch; table sorting and status filters do not change exports.
        </p>
      )}
      {exportError && (
        <p role="alert" className="report-details__error">
          {exportError}
        </p>
      )}
      <div className="report-details__controls">
        <label>
          Sort by
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value);
              setPage(1);
            }}
          >
            {sortOptions.map(({ value, label }) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort direction
          <select
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              setPage(1);
            }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        {sales && (
          <label>
            Order status
            <select
              value={orderStatus}
              onChange={(event) => {
                setOrderStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All qualifying statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {pending ? (
        <p role="status">Loading report records...</p>
      ) : error ? (
        <div role="alert" className="report-details__error">
          <p>{error}</p>
          {error !== 'You do not have permission to access this report.' && (
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry records
            </button>
          )}
        </div>
      ) : !rows?.length ? (
        <p role="status">No records match the selected report filters.</p>
      ) : (
        <div
          className="report-details__table-wrap"
          role="region"
          aria-label={sales ? 'Sales orders table' : 'Inventory items table'}
          tabIndex={0}
        >
          <table>
            <caption>
              {sales ? 'Masked sales orders' : 'Current stock items'}
            </caption>
            {sales ? (
              <>
                <thead>
                  <tr>
                    <th scope="col">Paid at</th>
                    <th scope="col">Order</th>
                    <th scope="col">Customer (masked)</th>
                    <th scope="col">Branch</th>
                    <th scope="col">Status</th>
                    <th scope="col">Items</th>
                    <th scope="col">Paid (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.paymentId || row.orderId}>
                      <td>{date(row.paidAt)}</td>
                      <td>{display(row.orderId)}</td>
                      <td>{display(row.customer?.name)}</td>
                      <td>{display(row.branchName)}</td>
                      <td>{display(row.orderStatus)}</td>
                      <td>{row.itemCount ?? 'Unavailable'}</td>
                      <td>{money(row.paidAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Category</th>
                    <th scope="col">Branch</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Status</th>
                    <th scope="col">Unit price</th>
                    <th scope="col">Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id || row.sku}>
                      <td>{display(row.name)}</td>
                      <td>{display(row.category)}</td>
                      <td>{display(row.branchName)}</td>
                      <td>{row.quantity ?? 'Unavailable'}</td>
                      <td>{display(row.reorderStatus)}</td>
                      <td>{money(row.unitPrice)}</td>
                      <td>{money(row.retailValuation)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}
      {!pending && !error && pagination && (
        <nav
          className="report-details__pagination"
          aria-label={sales ? 'Sales pages' : 'Inventory pages'}
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {Math.max(1, pagination.totalPages)} (
            {pagination.totalRecords} records)
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
