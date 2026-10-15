import apiClient from './apiClient';

export async function getOrders() {
  const result = await apiClient.get('/orders');
  if (!Array.isArray(result?.data)) throw new Error('Invalid orders response');
  return result.data;
}
export async function getOrder(id) {
  const result = await apiClient.get(`/orders/${encodeURIComponent(id)}`);
  if (
    !result?.data ||
    typeof result.data !== 'object' ||
    Array.isArray(result.data)
  )
    throw new Error('Invalid order response');
  return result.data;
}

export async function updateOrderStatus(id, status) {
  const result = await apiClient.patch(
    `/orders/${encodeURIComponent(id)}/status`,
    { status },
  );

  if (
    !result?.data ||
    typeof result.data !== 'object' ||
    Array.isArray(result.data)
  ) {
    throw new Error('Invalid order status update response');
  }

  return result.data;
}
