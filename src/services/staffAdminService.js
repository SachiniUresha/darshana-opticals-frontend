import apiClient from './apiClient';

/** Provision a Staff account using the authenticated DDP-067 endpoint. */
export async function provisionStaff(payload) {
  const response = await apiClient.post('/admin/staff', payload);
  if (!response?.success || !response?.data?.id) {
    throw new Error('The server did not confirm staff account creation.');
  }
  return response.data;
}

/**
 * DDP-093 provisional staff-directory adapter.
 * The backend issue proposes GET /api/admin/staff. Confirm its final pagination
 * and response DTO before live integration. No sample data is used here.
 */
export async function listStaffMembers({
  page = 1,
  limit = 20,
  isActive,
  search = '',
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (typeof isActive === 'boolean') params.set('isActive', String(isActive));
  if (typeof search === 'string' && search.trim())
    params.set('search', search.trim());
  const response = await apiClient.get(`/admin/staff?${params.toString()}`);
  const payload = response?.data;
  const staff = Array.isArray(payload) ? payload : payload?.staff;
  if (response?.success !== true || !Array.isArray(staff)) {
    throw new Error('Invalid staff directory response.');
  }
  return {
    staff,
    pagination:
      response.pagination ??
      (!Array.isArray(payload) ? (payload.pagination ?? null) : null),
  };
}

/** DDP-093 proposed management routes; align exact DTOs on backend integration. */
export async function getStaffMember(id) {
  const response = await apiClient.get(
    `/admin/staff/${encodeURIComponent(id)}`,
  );
  const record = response?.data?.staff ?? response?.data;
  if (response?.success !== true || typeof record?.id !== 'string') {
    throw new Error('Invalid staff details response.');
  }
  return record;
}

function requireUpdatedStaff(response) {
  const record = response?.data?.staff ?? response?.data;
  if (response?.success !== true || typeof record?.id !== 'string') {
    throw new Error('Staff update was not confirmed by the server.');
  }
  return record;
}

export async function updateStaffProfile(id, values) {
  return requireUpdatedStaff(
    await apiClient.patch(`/admin/staff/${encodeURIComponent(id)}`, values),
  );
}

export async function updateStaffRole(id, role) {
  return requireUpdatedStaff(
    await apiClient.patch(`/admin/staff/${encodeURIComponent(id)}/role`, {
      role,
    }),
  );
}

export async function reassignStaffBranch(id, branchId) {
  return requireUpdatedStaff(
    await apiClient.patch(`/admin/staff/${encodeURIComponent(id)}/branch`, {
      branchId,
    }),
  );
}

/** DDP-093 proposed status route. Final backend request/response DTO must be verified. */
export async function updateStaffStatus(id, isActive) {
  if (typeof id !== 'string' || !id.trim() || typeof isActive !== 'boolean') {
    throw new Error('Invalid staff activation request.');
  }
  const response = await apiClient.patch(
    `/admin/staff/${encodeURIComponent(id)}/status`,
    {
      isActive,
    },
  );
  const record = response?.data?.staff ?? response?.data;
  const confirmedStatus =
    typeof record?.isActive === 'boolean' ? record.isActive : record?.active;
  if (
    response?.success !== true ||
    typeof record?.id !== 'string' ||
    record.id !== id ||
    confirmedStatus !== isActive
  ) {
    throw new Error('Staff activation change was not confirmed by the server.');
  }
  return record;
}
