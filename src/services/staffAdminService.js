import apiClient from './apiClient';

/** Provision a Staff account using the authenticated DDP-067 endpoint. */
export async function provisionStaff(payload) {
  const response = await apiClient.post('/admin/staff', payload);
  if (!response?.success || !response?.data?.id) {
    throw new Error('The server did not confirm staff account creation.');
  }
  return response.data;
}
