import apiClient from './apiClient';

const INVALID_APPOINTMENT_RESPONSE =
  'Invalid appointment response received from the server.';

const APPOINTMENT_STATUSES = new Set(['CONFIRMED', 'CANCELLED']);

function invalidResponse() {
  throw new Error(INVALID_APPOINTMENT_RESPONSE);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidDate(value) {
  return isNonEmptyString(value) && !Number.isNaN(new Date(value).getTime());
}

function normalizeNullableId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isNonEmptyString(value)) {
    invalidResponse();
  }

  return value.trim();
}

function normalizeProvider(provider) {
  if (
    !provider ||
    typeof provider !== 'object' ||
    Array.isArray(provider) ||
    !isNonEmptyString(provider.id) ||
    !isNonEmptyString(provider.name) ||
    provider.role !== 'OPTOMETRIST' ||
    !isNonEmptyString(provider.branchId)
  ) {
    invalidResponse();
  }

  return {
    id: provider.id.trim(),
    name: provider.name.trim(),
    role: provider.role,
    branchId: provider.branchId.trim(),
  };
}

function normalizeDoctorSession(session) {
  if (
    !session ||
    typeof session !== 'object' ||
    Array.isArray(session) ||
    !isNonEmptyString(session.id) ||
    !isNonEmptyString(session.staffId) ||
    !isNonEmptyString(session.branchId) ||
    !isValidDate(session.startAt) ||
    !isValidDate(session.endAt) ||
    !Number.isSafeInteger(session.capacity) ||
    session.capacity < 1 ||
    !Number.isSafeInteger(session.confirmedCount) ||
    session.confirmedCount < 0 ||
    !Number.isSafeInteger(session.remainingCapacity) ||
    session.remainingCapacity < 0
  ) {
    invalidResponse();
  }

  const startAt = new Date(session.startAt);
  const endAt = new Date(session.endAt);

  if (
    startAt.getTime() >= endAt.getTime() ||
    session.confirmedCount > session.capacity ||
    session.remainingCapacity > session.capacity
  ) {
    invalidResponse();
  }

  return {
    id: session.id.trim(),
    staffId: session.staffId.trim(),
    branchId: session.branchId.trim(),
    startAt: session.startAt,
    endAt: session.endAt,
    capacity: session.capacity,
    confirmedCount: session.confirmedCount,
    remainingCapacity: session.remainingCapacity,
  };
}

function normalizeAppointment(appointment) {
  if (
    !appointment ||
    typeof appointment !== 'object' ||
    Array.isArray(appointment) ||
    !isNonEmptyString(appointment.id) ||
    !isNonEmptyString(appointment.staffId) ||
    !isValidDate(appointment.dateTime) ||
    !APPOINTMENT_STATUSES.has(appointment.status)
  ) {
    invalidResponse();
  }

  if (
    appointment.position !== undefined &&
    appointment.position !== null &&
    (!Number.isSafeInteger(appointment.position) || appointment.position < 1)
  ) {
    invalidResponse();
  }

  if (
    appointment.createdAt !== undefined &&
    !isValidDate(appointment.createdAt)
  ) {
    invalidResponse();
  }

  if (
    appointment.updatedAt !== undefined &&
    !isValidDate(appointment.updatedAt)
  ) {
    invalidResponse();
  }

  const providerName = isNonEmptyString(appointment.providerName)
    ? appointment.providerName.trim()
    : null;

  return {
    id: appointment.id.trim(),
    staffId: appointment.staffId.trim(),
    providerName,
    sessionId: normalizeNullableId(appointment.sessionId),
    branchId: normalizeNullableId(appointment.branchId),
    dateTime: appointment.dateTime,
    status: appointment.status,
    position: appointment.position ?? null,
    createdAt: appointment.createdAt ?? null,
    updatedAt: appointment.updatedAt ?? null,
  };
}

function normalizeListResponse(response, itemNormalizer) {
  if (response?.success !== true || !Array.isArray(response.data)) {
    invalidResponse();
  }

  return response.data.map(itemNormalizer);
}

function normalizeSingleResponse(response, itemNormalizer) {
  if (response?.success !== true) {
    invalidResponse();
  }

  return itemNormalizer(response.data);
}

export async function getAppointmentProviders() {
  const response = await apiClient.get('/appointments/providers', {
    authenticated: true,
  });

  return normalizeListResponse(response, normalizeProvider);
}

export async function getAvailableDoctorSessions() {
  const response = await apiClient.get('/doctor-sessions/available', {
    authenticated: true,
  });

  return normalizeListResponse(response, normalizeDoctorSession);
}

export async function createAppointment(sessionId) {
  if (!isNonEmptyString(sessionId)) {
    throw new Error('A valid doctor session is required.');
  }

  const response = await apiClient.post(
    '/appointments',
    {
      sessionId: sessionId.trim(),
    },
    {
      authenticated: true,
    },
  );

  return normalizeSingleResponse(response, normalizeAppointment);
}

export async function getCustomerAppointments() {
  const response = await apiClient.get('/appointments', {
    authenticated: true,
  });

  return normalizeListResponse(response, normalizeAppointment);
}

export async function getAppointment(appointmentId) {
  if (!isNonEmptyString(appointmentId)) {
    throw new Error('A valid appointment identifier is required.');
  }

  const response = await apiClient.get(
    `/appointments/${encodeURIComponent(appointmentId.trim())}`,
    {
      authenticated: true,
    },
  );

  return normalizeSingleResponse(response, normalizeAppointment);
}

export async function cancelAppointment(appointmentId) {
  if (!isNonEmptyString(appointmentId)) {
    throw new Error('A valid appointment identifier is required.');
  }

  const response = await apiClient.patch(
    `/appointments/${encodeURIComponent(appointmentId.trim())}/cancel`,
    undefined,
    {
      authenticated: true,
    },
  );

  if (response?.success !== true || response?.data?.success !== true) {
    invalidResponse();
  }

  return true;
}
