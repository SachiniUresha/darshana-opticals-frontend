import apiClient from './apiClient';

function normalizeCartResponse(response) {
  const items = response?.data?.items;

  if (!Array.isArray(items)) {
    throw new Error('Invalid cart response received from the server.');
  }

  return {
    items: items.map((item) => {
      const inventoryId = String(item?.inventoryId || '');
      const quantity = Number(item?.quantity);

      if (!inventoryId || !Number.isSafeInteger(quantity) || quantity < 1) {
        throw new Error('Invalid cart response received from the server.');
      }

      return {
        inventoryId,
        quantity,
      };
    }),
  };
}

export async function getCart() {
  const response = await apiClient.get('/cart', {
    authenticated: true,
  });

  return normalizeCartResponse(response);
}

export async function addCartItem(inventoryId, quantity = 1) {
  const response = await apiClient.post(
    '/cart/items',
    {
      inventoryId,
      quantity,
    },
    {
      authenticated: true,
    },
  );

  return normalizeCartResponse(response);
}

export async function updateCartItemQuantity(inventoryId, quantity) {
  const response = await apiClient.patch(
    `/cart/items/${encodeURIComponent(inventoryId)}`,
    {
      quantity,
    },
    {
      authenticated: true,
    },
  );

  return normalizeCartResponse(response);
}

export async function removeCartItem(inventoryId) {
  const response = await apiClient.delete(
    `/cart/items/${encodeURIComponent(inventoryId)}`,
    {
      authenticated: true,
    },
  );

  return normalizeCartResponse(response);
}
