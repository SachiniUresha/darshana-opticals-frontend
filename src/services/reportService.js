import apiClient from './apiClient';

// Send only parameters approved by the DDP-063 reporting API contract.
const SALES_SUMMARY_KEYS = [
  'preset',
  'startDate',
  'endDate',
  'branchId',
  'groupBy',
];
const SALES_ORDERS_KEYS = [
  'preset',
  'startDate',
  'endDate',
  'branchId',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
  'orderStatus',
];
const INVENTORY_SUMMARY_KEYS = [
  'branchId',
  'category',
  'reorderStatus',
  'groupBy',
];
const INVENTORY_ITEMS_KEYS = [
  'branchId',
  'category',
  'reorderStatus',
  'page',
  'limit',
  'sortBy',
  'sortOrder',
];

export function reportQuery(filters = {}, allowedKeys = []) {
  const params = new URLSearchParams();
  for (const key of allowedKeys) {
    const value = filters?.[key];
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    const text = String(value).trim();
    if (text) params.set(key, text);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

async function getSummary(path, filters, allowedKeys, expectedBreakdowns) {
  const response = await apiClient.get(
    `${path}${reportQuery(filters, allowedKeys)}`,
  );
  const data = response?.data;
  if (
    response?.success !== true ||
    !data ||
    typeof data.summary !== 'object' ||
    data.summary === null ||
    !data.breakdowns ||
    expectedBreakdowns.some((key) => !Array.isArray(data.breakdowns[key]))
  ) {
    throw new Error('Invalid reporting summary response.');
  }
  // Never recalculate revenue, stock, or financial totals in the browser.
  return data;
}

async function getDetail(path, filters, allowedKeys, collectionKey) {
  const response = await apiClient.get(
    `${path}${reportQuery(filters, allowedKeys)}`,
  );
  const data = response?.data;
  if (
    response?.success !== true ||
    !data ||
    !Array.isArray(data[collectionKey]) ||
    !data.pagination ||
    !Number.isSafeInteger(data.pagination.page) ||
    !Number.isSafeInteger(data.pagination.totalRecords) ||
    !Number.isSafeInteger(data.pagination.totalPages)
  ) {
    throw new Error('Invalid reporting detail response.');
  }
  return data;
}

export function getSalesReport(filters = {}) {
  return getSummary('/reports/sales', filters, SALES_SUMMARY_KEYS, [
    'byTime',
    'byBranch',
    'byCategory',
    'byPaymentMethod',
  ]);
}

export function getSalesOrders(filters = {}) {
  return getDetail(
    '/reports/sales/orders',
    filters,
    SALES_ORDERS_KEYS,
    'orders',
  );
}

export function getInventoryReport(filters = {}) {
  return getSummary('/reports/inventory', filters, INVENTORY_SUMMARY_KEYS, [
    'byBranch',
    'byCategory',
  ]);
}

export function getInventoryItems(filters = {}) {
  return getDetail(
    '/reports/inventory/items',
    filters,
    INVENTORY_ITEMS_KEYS,
    'items',
  );
}
