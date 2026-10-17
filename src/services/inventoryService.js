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
