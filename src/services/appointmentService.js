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

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isNonEmptyString(value)) {
    invalidResponse();
  }

  return value.trim();
}

function normalizeDoctor(doctor, { required = false } = {}) {
  if (doctor === undefined || doctor === null) {
    if (required) {
      invalidResponse();
    }

    return null;
  }

  if (
    typeof doctor !== 'object' ||
    Array.isArray(doctor) ||
    !isNonEmptyString(doctor.id) ||
    !isNonEmptyString(doctor.name) ||
    !isNonEmptyString(doctor.specialization)
  ) {
    invalidResponse();
  }

  return {
    id: doctor.id.trim(),
    name: doctor.name.trim(),
    specialization: doctor.specialization.trim(),
  };
}

function normalizeProvider(provider) {
  return normalizeDoctor(provider, { required: true });
}

function normalizeDoctorSession(session) {
  if (
    !session ||
    typeof session !== 'object' ||
    Array.isArray(session) ||
    !isNonEmptyString(session.id) ||
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

  const doctorId = normalizeNullableId(session.doctorId);
  const staffId = normalizeNullableId(session.staffId);
  const doctor = normalizeDoctor(session.doctor);

  if (doctor && doctorId && doctor.id !== doctorId) {
    invalidResponse();
  }

  return {
    id: session.id.trim(),
    doctorId,
    staffId,
    doctor,
    doctorName:
      normalizeOptionalString(session.doctorName) ?? doctor?.name ?? null,
    specialization:
      normalizeOptionalString(session.specialization) ??
      doctor?.specialization ??
      null,
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

  const doctorId = normalizeNullableId(appointment.doctorId);
  const staffId = normalizeNullableId(appointment.staffId);
  const doctor = normalizeDoctor(appointment.doctor);

  if (doctor && doctorId && doctor.id !== doctorId) {
    invalidResponse();
  }

  return {
    id: appointment.id.trim(),
    doctorId,
    staffId,
    doctor,
    doctorName:
      normalizeOptionalString(appointment.doctorName) ?? doctor?.name ?? null,
    specialization:
      normalizeOptionalString(appointment.specialization) ??
      doctor?.specialization ??
      null,
    providerName: normalizeOptionalString(appointment.providerName),
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
