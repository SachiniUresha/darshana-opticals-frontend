import apiClient from './apiClient';

/** Read-only branch Inventory retrieval. Backend enforces role and branch scope. */
export async function getBranchInventory(branchId) {
  if (typeof branchId !== 'string' || !branchId.trim()) {
    throw new Error('A branch is required to load inventory.');
  }

  const response = await apiClient.get(
    `/inventory/branch/${encodeURIComponent(branchId)}`,
  );

  if (!Array.isArray(response?.data)) {
    throw new Error('Invalid inventory response.');
  }

  return response.data;
}

/** Create using supported fields; branch scope is checked again by the backend. */
export async function createInventoryItem(branchId, values) {
  const response = await apiClient.post('/inventory', {
    branchId,
    itemName: values.itemName,
    category: values.category,
    brand: values.brand,
    price: values.price,
    quantity: values.quantity,
  });

  if (!response?.data || response.success !== true) {
    throw new Error('Invalid inventory creation response.');
  }

  return response.data;
}

/** General metadata changes are for an authorized Branch Manager only. */
export async function updateInventoryItem(id, values) {
  const response = await apiClient.patch(
    `/inventory/${encodeURIComponent(id)}`,
    {
      itemName: values.itemName,
      category: values.category,
      brand: values.brand,
      price: values.price,
    },
  );

  if (!response?.data || response.success !== true) {
    throw new Error('Invalid inventory update response.');
  }

  return response.data;
}

/** Quantity is an absolute stock count. The backend handles alerts and scope. */
export async function updateInventoryQuantity(id, quantity) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('An inventory item is required.');
  }
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error('Quantity must be a non-negative whole number.');
  }

  const response = await apiClient.patch(
    `/inventory/${encodeURIComponent(id)}/quantity`,
    { quantity },
  );

  if (!response?.data || response.success !== true) {
    throw new Error('Invalid inventory quantity response.');
  }

  return response.data;
}

/** System Admin has price-only override; never send other metadata. */
export async function overrideInventoryPrice(id, price) {
  const response = await apiClient.patch(
    `/inventory/${encodeURIComponent(id)}`,
    {
      price,
    },
  );

  if (!response?.data || response.success !== true) {
    throw new Error('Invalid inventory price response.');
  }

  return response.data;
}

/** Retrieve only active reorder alerts from the backend for an authorized branch. */
export async function getActiveReorderAlerts(branchId, page = 1) {
  if (typeof branchId !== 'string' || !branchId.trim()) {
    throw new Error('A branch is required to load reorder alerts.');
  }
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error('An invalid reorder alert page was requested.');
  }

  const response = await apiClient.get(
    `/inventory/reorder-alerts/branch/${encodeURIComponent(branchId)}?page=${page}&limit=20`,
  );
  const result = response?.data;

  if (
    response?.success !== true ||
    !Array.isArray(result?.alerts) ||
    !Number.isSafeInteger(result?.total) ||
    result.total < 0 ||
    !Number.isSafeInteger(result?.page) ||
    result.page < 1 ||
    !Number.isSafeInteger(result?.limit) ||
    result.limit < 1
  ) {
    throw new Error('Invalid reorder alerts response.');
  }

  return result;
}

/** Read the backend's authoritative global reorder threshold. */
export async function getGlobalReorderThreshold() {
  const response = await apiClient.get('/inventory/reorder-threshold');
  const threshold = response?.data?.threshold;

  if (
    response?.success !== true ||
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold < 0
  ) {
    throw new Error('Invalid reorder threshold response.');
  }

  return threshold;
}

/** Backend reconciles alerts; never update frontend stock/alert state locally. */
export async function updateGlobalReorderThreshold(threshold) {
  if (
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold < 0
  ) {
    throw new Error('Threshold must be a non-negative number.');
  }

  const response = await apiClient.put('/inventory/reorder-threshold', {
    threshold,
  });
  const confirmed = response?.data?.threshold;

  if (
    response?.success !== true ||
    typeof confirmed !== 'number' ||
    !Number.isFinite(confirmed) ||
    confirmed < 0
  ) {
    throw new Error('Invalid reorder threshold update response.');
  }

  return confirmed;
}
