import apiClient from './apiClient';

/** Registers a Doctor record without creating Staff or authentication credentials. */
export async function createDoctor({ name, specialization }) {
  const response = await apiClient.post('/doctors', { name, specialization });
  if (
    !response?.success ||
    typeof response?.data?.id !== 'string' ||
    typeof response?.data?.name !== 'string' ||
    typeof response?.data?.specialization !== 'string'
  ) {
    throw new Error('The server did not confirm doctor registration.');
  }
  return {
    id: response.data.id,
    name: response.data.name,
    specialization: response.data.specialization,
  };
}

/** DDP-093 provisional management endpoints. Confirm paths and DTOs before integration. */
function readManagedDoctor(record) {
  if (
    !record ||
    typeof record.id !== 'string' ||
    !record.id.trim() ||
    typeof record.name !== 'string' ||
    !record.name.trim() ||
    typeof record.specialization !== 'string' ||
    !record.specialization.trim()
  ) {
    throw new Error('Invalid Doctor management response.');
  }
  const isActive =
    typeof record.isActive === 'boolean'
      ? record.isActive
      : typeof record.active === 'boolean'
        ? record.active
        : null;
  return {
    id: record.id,
    name: record.name,
    specialization: record.specialization,
    isActive,
  };
}

export async function listManagedDoctors({ isActive, search = '' } = {}) {
  const params = new URLSearchParams();
  if (typeof isActive === 'boolean') params.set('isActive', String(isActive));
  if (typeof search === 'string' && search.trim())
    params.set('search', search.trim());
  const query = params.toString();
  const response = await apiClient.get(
    `/admin/doctors${query ? `?${query}` : ''}`,
  );
  const rows = Array.isArray(response?.data)
    ? response.data
    : response?.data?.doctors;
  if (response?.success !== true || !Array.isArray(rows)) {
    throw new Error('Invalid Doctor management list response.');
  }
  return rows.map(readManagedDoctor);
}

export async function updateDoctorDetails(id, fields) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Doctor identifier is required.');
  }
  const response = await apiClient.patch(
    `/admin/doctors/${encodeURIComponent(id)}`,
    fields,
  );
  const doctor = response?.data?.doctor ?? response?.data;
  if (response?.success !== true) {
    throw new Error('Doctor update was not confirmed by the server.');
  }
  const safe = readManagedDoctor(doctor);
  if (
    safe.id !== id ||
    safe.name !== fields.name ||
    safe.specialization !== fields.specialization
  ) {
    throw new Error('Doctor update was not confirmed by the server.');
  }
  return safe;
}

export async function updateDoctorStatus(id, isActive) {
  if (typeof id !== 'string' || !id.trim() || typeof isActive !== 'boolean') {
    throw new Error('Invalid Doctor activation request.');
  }
  const response = await apiClient.patch(
    `/admin/doctors/${encodeURIComponent(id)}/status`,
    { isActive },
  );
  const doctor = response?.data?.doctor ?? response?.data;
  if (response?.success !== true) {
    throw new Error(
      'Doctor activation change was not confirmed by the server.',
    );
  }
  const safe = readManagedDoctor(doctor);
  if (safe.id !== id || safe.isActive !== isActive) {
    throw new Error(
      'Doctor activation change was not confirmed by the server.',
    );
  }
  return safe;
}
