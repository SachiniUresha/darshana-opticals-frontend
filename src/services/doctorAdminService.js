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
