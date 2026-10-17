import apiClient from './apiClient';

const INVALID_CUSTOMER_LOYALTY_RESPONSE =
  'Invalid customer loyalty response received from the server.';

const INVALID_MANAGEMENT_LOYALTY_RESPONSE =
  'Invalid loyalty monitoring response received from the server.';

export const LOYALTY_EVENT_TYPES = [
  'EARN_PURCHASE',
  'REFUND_REVERSAL',
  'REDEMPTION_DEDUCTION',
];

const LOYALTY_EVENT_TYPE_SET = new Set(LOYALTY_EVENT_TYPES);

function invalidResponse(message) {
  throw new Error(message);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidObjectId(value) {
  return isNonEmptyString(value) && /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function isValidDecimal(value) {
  return typeof value === 'string' && /^-?\d+\.\d{2}$/.test(value);
}

function isValidDate(value) {
  return isNonEmptyString(value) && !Number.isNaN(new Date(value).getTime());
}

function normalizePagination(pagination, errorMessage) {
  if (
    !isObject(pagination) ||
    !Number.isSafeInteger(pagination.page) ||
    pagination.page < 1 ||
    pagination.page > 10000 ||
    !Number.isSafeInteger(pagination.limit) ||
    pagination.limit < 1 ||
    pagination.limit > 100 ||
    !Number.isSafeInteger(pagination.total) ||
    pagination.total < 0 ||
    !Number.isSafeInteger(pagination.totalPages) ||
    pagination.totalPages < 0
  ) {
    invalidResponse(errorMessage);
  }

  return {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages: pagination.totalPages,
  };
}

function normalizeCustomerTransaction(transaction) {
  if (
    !isObject(transaction) ||
    !isValidObjectId(transaction.id) ||
    !LOYALTY_EVENT_TYPE_SET.has(transaction.type) ||
    !isValidDecimal(transaction.pointsDelta) ||
    !isValidDecimal(transaction.balanceAfter) ||
    !isValidObjectId(transaction.orderId) ||
    !isValidDate(transaction.createdAt)
  ) {
    invalidResponse(INVALID_CUSTOMER_LOYALTY_RESPONSE);
  }

  return {
    id: transaction.id.trim(),
    type: transaction.type,
    pointsDelta: transaction.pointsDelta,
    balanceAfter: transaction.balanceAfter,
    orderId: transaction.orderId.trim(),
    createdAt: transaction.createdAt,
  };
}

function normalizeManagementTransaction(transaction) {
  if (
    !isObject(transaction) ||
    !isValidObjectId(transaction.id) ||
    !isValidObjectId(transaction.customerId) ||
    !isValidObjectId(transaction.orderId) ||
    !isValidObjectId(transaction.paymentId) ||
    !LOYALTY_EVENT_TYPE_SET.has(transaction.type) ||
    !isValidDecimal(transaction.pointsDelta) ||
    !isValidDecimal(transaction.balanceAfter) ||
    !isValidDate(transaction.createdAt)
  ) {
    invalidResponse(INVALID_MANAGEMENT_LOYALTY_RESPONSE);
  }

  return {
    id: transaction.id.trim(),
    customerId: transaction.customerId.trim(),
    orderId: transaction.orderId.trim(),
    paymentId: transaction.paymentId.trim(),
    type: transaction.type,
    pointsDelta: transaction.pointsDelta,
    balanceAfter: transaction.balanceAfter,
    createdAt: transaction.createdAt,
  };
}

function normalizeCustomerResponse(response) {
  const data = response?.data;

  if (
    response?.success !== true ||
    !isObject(data) ||
    !isValidDecimal(data.balance) ||
    !Array.isArray(data.transactions)
  ) {
    invalidResponse(INVALID_CUSTOMER_LOYALTY_RESPONSE);
  }

  return {
    balance: data.balance,
    transactions: data.transactions.map(normalizeCustomerTransaction),
    pagination: normalizePagination(
      data.pagination,
      INVALID_CUSTOMER_LOYALTY_RESPONSE,
    ),
  };
}

function normalizeManagementResponse(response) {
  const data = response?.data;

  if (
    response?.success !== true ||
    !isObject(data) ||
    !Array.isArray(data.transactions)
  ) {
    invalidResponse(INVALID_MANAGEMENT_LOYALTY_RESPONSE);
  }

  return {
    transactions: data.transactions.map(normalizeManagementTransaction),
    pagination: normalizePagination(
      data.pagination,
      INVALID_MANAGEMENT_LOYALTY_RESPONSE,
    ),
  };
}

function appendPagination(params, { page, limit } = {}) {
  if (page !== undefined) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      throw new Error('Loyalty page must be an integer from 1 to 10000.');
    }

    params.set('page', String(page));
  }

  if (limit !== undefined) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error('Loyalty limit must be an integer from 1 to 100.');
    }

    params.set('limit', String(limit));
  }
}

export async function getOwnLoyalty(options = {}) {
  const params = new URLSearchParams();
  appendPagination(params, options);

  const query = params.toString();
  const path = query ? `/loyalty/me?${query}` : '/loyalty/me';

  const response = await apiClient.get(path, {
    authenticated: true,
  });

  return normalizeCustomerResponse(response);
}

export async function getManagementLoyalty(filters = {}) {
  const params = new URLSearchParams();

  appendPagination(params, filters);

  for (const field of ['customerId', 'orderId', 'paymentId']) {
    const value = filters[field];

    if (value !== undefined && value !== '') {
      if (!isValidObjectId(value)) {
        throw new Error(`${field} must be a valid identifier.`);
      }

      params.set(field, value.trim());
    }
  }

  if (filters.eventType !== undefined && filters.eventType !== '') {
    if (!LOYALTY_EVENT_TYPE_SET.has(filters.eventType)) {
      throw new Error('Invalid loyalty event type.');
    }

    params.set('eventType', filters.eventType);
  }

  if (filters.sortOrder !== undefined && filters.sortOrder !== '') {
    if (!['asc', 'desc'].includes(filters.sortOrder)) {
      throw new Error('Loyalty sort order must be asc or desc.');
    }

    params.set('sortOrder', filters.sortOrder);
  }

  const query = params.toString();
  const path = query ? `/loyalty?${query}` : '/loyalty';

  const response = await apiClient.get(path, {
    authenticated: true,
  });

  return normalizeManagementResponse(response);
}
