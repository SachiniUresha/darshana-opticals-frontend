export const orderId = (o) => o?.id ?? o?.orderId;
export const orderTotal = (o) => o?.orderAmount ?? o?.totalAmount ?? o?.total;
export const orderDate = (o) => o?.createdAt ?? o?.orderDate;
export function dateLabel(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
}
export function moneyLabel(value) {
  if (value === undefined || value === null || value === '')
    return 'Amount unavailable';
  const n = Number(value);
  return Number.isFinite(n)
    ? `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Amount unavailable';
}
export function statusLabel(value) {
  return typeof value === 'string' && value.trim()
    ? value.replace(/_/g, ' ')
    : 'Status unavailable';
}
export function errorLabel(error) {
  if (error?.status === 403 || error?.status === 404)
    return 'This order is unavailable or you do not have access to it.';
  if (error?.status === 400 || error?.status === 422)
    return 'Invalid order identifier.';
  if (error?.status === 0)
    return 'Cannot connect to the server. Check your connection and try again.';
  return 'Unable to load orders. Please try again.';
}

export function historyErrorLabel(error) {
  if (error?.status === 404)
    return 'Order history is currently unavailable. Please try again later.';
  if (error?.status === 403)
    return 'You do not have permission to view your order history.';
  if (error?.status === 0)
    return 'Cannot connect to the server. Check your connection and try again.';
  return 'Unable to load order history. Please try again.';
}
