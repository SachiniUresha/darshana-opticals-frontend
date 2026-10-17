import apiClient from './apiClient';

const INVALID_PAYMENT_INITIATION_RESPONSE =
  'Invalid payment initiation response received from the server.';

const INVALID_PAYMENT_STATUS_RESPONSE =
  'Invalid payment status response received from the server.';

const PAYMENT_STATUSES = new Set([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'refunded',
]);

const PAYMENT_METHOD = 'online_gateway';
const PAYMENT_CURRENCY = 'LKR';

const PAYHERE_GATEWAY_FIELDS = new Set([
  'merchant_id',
  'return_url',
  'cancel_url',
  'notify_url',
  'first_name',
  'last_name',
  'email',
  'phone',
  'address',
  'city',
  'country',
  'order_id',
  'items',
  'currency',
  'amount',
  'hash',
]);

const REQUIRED_PAYHERE_GATEWAY_FIELDS = [
  'merchant_id',
  'return_url',
  'cancel_url',
  'notify_url',
  'first_name',
  'last_name',
  'email',
  'phone',
  'address',
  'city',
  'country',
  'order_id',
  'items',
  'currency',
  'amount',
  'hash',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

function isValidDate(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function normalizePaymentAttempt(
  attempt,
  errorMessage,
  { allowNullableExpiresAt = false } = {},
) {
  if (!isObject(attempt)) {
    throw new Error(errorMessage);
  }

  const paymentId = String(attempt.paymentId || '');
  const orderId = String(attempt.orderId || '');
  const amount = Number(attempt.amount);

  const validExpiresAt =
    (allowNullableExpiresAt && attempt.expiresAt === null) ||
    isValidDate(attempt.expiresAt);

  if (
    !isValidObjectId(paymentId) ||
    !isValidObjectId(orderId) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    attempt.currency !== PAYMENT_CURRENCY ||
    attempt.method !== PAYMENT_METHOD ||
    !PAYMENT_STATUSES.has(attempt.status) ||
    !validExpiresAt ||
    typeof attempt.reconciliationRequired !== 'boolean' ||
    !isValidDate(attempt.createdAt) ||
    !isValidDate(attempt.updatedAt)
  ) {
    throw new Error(errorMessage);
  }

  return {
    ...attempt,
    paymentId,
    orderId,
    amount,
  };
}

function normalizeGateway(gateway) {
  if (!isObject(gateway) || !isNonEmptyString(gateway.checkoutUrl)) {
    throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
  }

  let checkoutUrl;

  try {
    checkoutUrl = new URL(gateway.checkoutUrl);
  } catch {
    throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
  }

  if (checkoutUrl.protocol !== 'https:') {
    throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
  }

  if (!isObject(gateway.fields)) {
    throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
  }

  for (const field of Object.keys(gateway.fields)) {
    if (!PAYHERE_GATEWAY_FIELDS.has(field)) {
      throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
    }
  }

  for (const field of REQUIRED_PAYHERE_GATEWAY_FIELDS) {
    if (!isNonEmptyString(gateway.fields[field])) {
      throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
    }
  }

  if (gateway.fields.currency !== PAYMENT_CURRENCY) {
    throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
  }

  if (!/^\d+\.\d{2}$/.test(gateway.fields.amount)) {
    throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
  }

  if (!/^[A-F0-9]{32}$/.test(gateway.fields.hash)) {
    throw new Error(INVALID_PAYMENT_INITIATION_RESPONSE);
  }

  return {
    checkoutUrl: gateway.checkoutUrl,
    fields: { ...gateway.fields },
  };
}

function normalizePaymentInitiationResponse(response) {
  const payment = response?.data?.payment;
  const gateway = response?.data?.gateway;

  return {
    payment: normalizePaymentAttempt(
      payment,
      INVALID_PAYMENT_INITIATION_RESPONSE,
    ),
    gateway: normalizeGateway(gateway),
  };
}

function normalizeNullableAttempt(attempt) {
  if (attempt === null) {
    return null;
  }

  return normalizePaymentAttempt(attempt, INVALID_PAYMENT_STATUS_RESPONSE, {
    allowNullableExpiresAt: true,
  });
}

function normalizePaymentStatusResponse(response) {
  const data = response?.data;

  if (
    !isObject(data) ||
    !isValidObjectId(String(data.orderId || '')) ||
    !isNonEmptyString(data.orderStatus) ||
    !isObject(data.summary) ||
    typeof data.summary.paid !== 'boolean' ||
    typeof data.summary.reconciliationRequired !== 'boolean' ||
    typeof data.summary.activeAttempt !== 'boolean' ||
    !Number.isSafeInteger(data.summary.attemptCount) ||
    data.summary.attemptCount < 0 ||
    !Array.isArray(data.attempts)
  ) {
    throw new Error(INVALID_PAYMENT_STATUS_RESPONSE);
  }

  const attempts = data.attempts.map((attempt) =>
    normalizePaymentAttempt(attempt, INVALID_PAYMENT_STATUS_RESPONSE, {
      allowNullableExpiresAt: true,
    }),
  );

  const latestAttempt = normalizeNullableAttempt(data.latestAttempt);
  const completedAttempt = normalizeNullableAttempt(data.completedAttempt);

  return {
    orderId: String(data.orderId),
    orderStatus: data.orderStatus,
    summary: {
      paid: data.summary.paid,
      reconciliationRequired: data.summary.reconciliationRequired,
      activeAttempt: data.summary.activeAttempt,
      attemptCount: data.summary.attemptCount,
    },
    latestAttempt,
    completedAttempt,
    attempts,
  };
}

function normalizeBillingValue(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string.`);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.length > 120) {
    throw new TypeError(`${fieldName} must be between 1 and 120 characters.`);
  }

  return trimmedValue;
}

export async function initiatePayment({
  orderId,
  city,
  firstName,
  lastName,
  address,
}) {
  if (!isValidObjectId(orderId)) {
    throw new TypeError('A valid order ID is required.');
  }

  const requestBody = {
    orderId,
    city: normalizeBillingValue(city, 'city'),
  };

  if (!requestBody.city) {
    throw new TypeError('city is required.');
  }

  const normalizedFirstName = normalizeBillingValue(firstName, 'firstName');
  const normalizedLastName = normalizeBillingValue(lastName, 'lastName');
  const normalizedAddress = normalizeBillingValue(address, 'address');

  if (normalizedFirstName !== undefined) {
    requestBody.firstName = normalizedFirstName;
  }

  if (normalizedLastName !== undefined) {
    requestBody.lastName = normalizedLastName;
  }

  if (normalizedAddress !== undefined) {
    requestBody.address = normalizedAddress;
  }

  const response = await apiClient.post('/payments/initiate', requestBody, {
    authenticated: true,
  });

  return normalizePaymentInitiationResponse(response);
}

export async function getPaymentStatus(orderId) {
  if (!isValidObjectId(orderId)) {
    throw new TypeError('A valid order ID is required.');
  }

  const response = await apiClient.get(
    `/orders/${encodeURIComponent(orderId)}/payment-status`,
    {
      authenticated: true,
    },
  );

  return normalizePaymentStatusResponse(response);
}
