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

/** Upload one image via the protected backend; the browser never calls Cloudinary directly. */
export async function uploadInventoryImage(file) {
  const body = new FormData();
  body.append('image', file);
  const response = await apiClient.post('/inventory/images', body);
  const imageUrl = response?.data?.imageUrl;
  const imagePublicId = response?.data?.imagePublicId;

  if (
    response?.success !== true ||
    typeof imageUrl !== 'string' ||
    !imageUrl.startsWith('https://') ||
    typeof imagePublicId !== 'string' ||
    !imagePublicId.startsWith('osms/inventory/')
  ) {
    throw new Error('Invalid inventory image upload response.');
  }

  return { imageUrl, imagePublicId };
}

/** Create using supported fields; branch scope is checked again by the backend. */
export async function createInventoryItem(branchId, values, imageMetadata) {
  const payload = {
    branchId,
    itemName: values.itemName,
    category: values.category,
    brand: values.brand,
    price: values.price,
    quantity: values.quantity,
    itemClassification: values.itemClassification,
  };
  if (imageMetadata) {
    payload.imageUrl = imageMetadata.imageUrl;
    payload.imagePublicId = imageMetadata.imagePublicId;
  }
  const response = await apiClient.post('/inventory', payload);

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
      itemClassification: values.itemClassification,
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

/** Replace an item's image using only metadata approved by the backend upload endpoint. */
export async function replaceInventoryImage(id, imageMetadata) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('An inventory item is required.');
  }
  if (
    typeof imageMetadata?.imageUrl !== 'string' ||
    !imageMetadata.imageUrl.startsWith('https://') ||
    typeof imageMetadata?.imagePublicId !== 'string' ||
    !imageMetadata.imagePublicId.startsWith('osms/inventory/')
  ) {
    throw new Error('Approved inventory image metadata is required.');
  }
  const response = await apiClient.patch(
    `/inventory/${encodeURIComponent(id)}`,
    {
      imageUrl: imageMetadata.imageUrl,
      imagePublicId: imageMetadata.imagePublicId,
    },
  );
  if (response?.success !== true || !response?.data) {
    throw new Error('Invalid inventory image replacement response.');
  }
  return response.data;
}

/** Remove an item's existing image; backend enforces branch ownership and cleans up assets. */
export async function removeInventoryImage(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('An inventory item is required.');
  }
  const response = await apiClient.delete(
    `/inventory/${encodeURIComponent(id)}/image`,
  );
  if (response?.success !== true) {
    throw new Error('Invalid inventory image removal response.');
  }
  return response;
}
