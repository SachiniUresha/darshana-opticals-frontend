import apiClient from '../apiClient';

function readList(response, message) {
  if (!Array.isArray(response?.data)) {
    throw new Error(message);
  }

  return response.data;
}

function readRecord(response, message) {
  if (
    !response?.data ||
    typeof response.data !== 'object' ||
    Array.isArray(response.data)
  ) {
    throw new Error(message);
  }

  return response.data;
}

// CUSTOMER: Load only the authenticated customer's prescription history.
async function getMyPrescriptions() {
  const response = await apiClient.get('/prescriptions/me');

  return readList(response, 'Invalid prescription history response.');
}

// OPTOMETRIST: Search customers using the approved lookup API.
async function searchCustomers(query) {
  const searchTerm = query.trim();

  if (searchTerm.length < 2 || searchTerm.length > 100) {
    throw new Error('Search must contain between 2 and 100 characters.');
  }

  const response = await apiClient.get(
    `/customers/lookup?q=${encodeURIComponent(searchTerm)}`,
  );

  return readList(response, 'Invalid customer lookup response.');
}

// OPTOMETRIST: Retrieve a selected customer's prescription history.
// Not currently used by the recording UI. Retained for potential future
// Optometrist history-view functionality using the existing backend API.
async function getCustomerPrescriptions(customerId) {
  if (!customerId) {
    throw new Error('A customer must be selected.');
  }

  const response = await apiClient.get(
    `/prescriptions/customer/${encodeURIComponent(customerId)}`,
  );

  return readList(response, 'Invalid customer prescription response.');
}

// OPTOMETRIST: Create a new, historical prescription.
async function createPrescription(values) {
  const payload = {
    customerId: values.customerId,
    rightEye: values.rightEye,
    leftEye: values.leftEye,
    remarks: values.remarks,
  };

  const response = await apiClient.post('/prescriptions', payload);

  return readRecord(response, 'Invalid prescription creation response.');
}

const prescriptionService = {
  getMyPrescriptions,
  searchCustomers,
  getCustomerPrescriptions,
  createPrescription,
};

export default prescriptionService;
