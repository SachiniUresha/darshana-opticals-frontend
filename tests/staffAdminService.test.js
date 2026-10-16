import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import { provisionStaff } from '../src/services/staffAdminService';

vi.mock('../src/services/apiClient', () => ({ default: { post: vi.fn() } }));

const SAFE_STAFF = {
  id: 'staff-1',
  name: 'Nimal Perera',
  email: 'nimal@example.com',
  role: 'OPTOMETRIST',
};

describe('staffAdminService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the authenticated staff provisioning API and returns safe data', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: SAFE_STAFF });
    const payload = {
      name: 'Nimal Perera',
      email: 'nimal@example.com',
      role: 'OPTOMETRIST',
      password: 'Secure123',
    };
    await expect(provisionStaff(payload)).resolves.toEqual(SAFE_STAFF);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/staff', payload);
  });

  it('does not report success when server response is missing account data', async () => {
    apiClient.post.mockResolvedValue({ success: true, data: {} });
    await expect(provisionStaff({})).rejects.toThrow(/did not confirm/i);
  });
});
