import { env } from '../config/env';
import authStorage from './auth/authStorage';
import { reportQuery } from './reportService';

// Exports are binary; the existing shared JSON API client cannot consume them.
// Keep authentication and URL conventions consistent with apiClient.
const SALES_KEYS = ['preset', 'startDate', 'endDate', 'branchId', 'format'];
const INVENTORY_KEYS = ['branchId', 'category', 'reorderStatus', 'format'];

export async function downloadReportExport(
  kind,
  filters = {},
  format = 'xlsx',
) {
  if (
    !['sales', 'inventory'].includes(kind) ||
    !['csv', 'xlsx'].includes(format)
  ) {
    throw new Error('Unsupported report export.');
  }

  const token = authStorage.getToken();
  if (!token) {
    const error = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }

  const allowed = kind === 'sales' ? SALES_KEYS : INVENTORY_KEYS;
  const query = reportQuery({ ...filters, format }, allowed);
  const path = `${env.apiBaseUrl.replace(/\/+$/, '')}/reports/${kind}/export${query}`;
  let response;
  try {
    response = await fetch(path, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    const error = new Error('Report export is unavailable.');
    error.status = 0;
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Report export was rejected by the server.');
    error.status = response.status;
    throw error;
  }

  // Filenames are constant and independent of user/server-supplied text.
  const blob = await response.blob();
  if (blob.size === 0) throw new Error('The report export was empty.');
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `osms-${kind}-report.${format}`;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
