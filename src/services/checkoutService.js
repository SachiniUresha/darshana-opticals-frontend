import apiClient from './apiClient';

const INVALID_CHECKOUT_RESPONSE =
  'Invalid checkout response received from the server.';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCheckoutItem(item) {
  const id = String(item?.id || '');
  const itemName = typeof item?.itemName === 'string' ? item.itemName : '';
  const price = Number(item?.price);
  const quantity = Number(item?.quantity);

  if (
    !id ||
    !itemName ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error(INVALID_CHECKOUT_RESPONSE);
  }

  return {
    id,
    itemName,
    price,
    quantity,
  };
}

function normalizeCheckoutResponse(response) {
  const order = response?.data?.order;
  const items = response?.data?.items;

  if (
    !order ||
    typeof order !== 'object' ||
    Array.isArray(order) ||
    !Array.isArray(items)
  ) {
    throw new Error(INVALID_CHECKOUT_RESPONSE);
  }

  const id = String(order.id || '');
  const customerId = String(order.customerId || '');
  const orderAmount = Number(order.orderAmount);

  if (
    !id ||
    !customerId ||
    !isNonEmptyString(order.orderDate) ||
    !Number.isFinite(orderAmount) ||
    orderAmount < 0 ||
    !isNonEmptyString(order.status)
  ) {
    throw new Error(INVALID_CHECKOUT_RESPONSE);
  }

  return {
    order: {
      ...order,
      id,
      customerId,
      orderAmount,
    },
    items: items.map(normalizeCheckoutItem),
  };
}

export async function submitCheckout() {
  const response = await apiClient.post(
    '/checkout',
    {},
    {
      authenticated: true,
    },
  );

  return normalizeCheckoutResponse(response);
}
