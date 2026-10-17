import apiClient from './apiClient';

function requireObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }

  return value;
}

function requireArray(value, message) {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }

  return value;
}

export async function getAppointmentProviders() {
  const response = await apiClient.get('/appointments/providers');

  return requireArray(response?.data, 'Invalid appointment providers response');
}

export async function getDoctorSessions() {
  const response = await apiClient.get('/doctor-sessions');

  return requireArray(response?.data, 'Invalid doctor sessions response');
}

export async function createDoctorSession(session) {
  const response = await apiClient.post('/doctor-sessions', session);

  return requireObject(response?.data, 'Invalid doctor session response');
}

export async function updateDoctorSession(id, updates) {
  const response = await apiClient.patch(
    `/doctor-sessions/${encodeURIComponent(id)}`,
    updates,
  );

  return requireObject(response?.data, 'Invalid doctor session response');
}

export async function getStaffAppointments() {
  const response = await apiClient.get('/appointments');

  return requireArray(response?.data, 'Invalid staff appointments response');
}

export async function getStaffAppointment(id) {
  const response = await apiClient.get(
    `/appointments/${encodeURIComponent(id)}`,
  );

  return requireObject(response?.data, 'Invalid staff appointment response');
}

export async function cancelStaffAppointment(id) {
  const response = await apiClient.patch(
    `/appointments/${encodeURIComponent(id)}/cancel`,
  );

  const result = requireObject(
    response?.data,
    'Invalid appointment cancellation response',
  );

  if (result.success !== true) {
    throw new Error('Invalid appointment cancellation response');
  }

  return result;
}

export async function reassignStaffAppointment(id, sessionId) {
  const response = await apiClient.patch(
    `/appointments/${encodeURIComponent(id)}/reassign`,
    { sessionId },
  );

  const result = requireObject(
    response?.data,
    'Invalid appointment reassignment response',
  );

  if (result.success !== true) {
    throw new Error('Invalid appointment reassignment response');
  }

  return result;
}
