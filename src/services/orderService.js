import apiClient from './apiClient';

// Provisional endpoints/fields: verify with backend DDP-043 Swagger before merge.
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
