import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  provisionStaff,
  listStaffMembers,
  getStaffMember,
  updateStaffProfile,
  updateStaffRole,
  reassignStaffBranch,
  updateStaffStatus,
} from '../src/services/staffAdminService';

vi.mock('../src/services/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
}));

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

describe('DDP-094 provisional staff directory service', () => {
  it('uses the approved admin resource and reads safe staff records', async () => {
    const staff = [
      { id: 'staff-1', name: 'A Person', role: 'OPTOMETRIST', isActive: true },
    ];
    apiClient.get.mockResolvedValue({
      success: true,
      data: { staff, pagination: { page: 1, totalPages: 2 } },
    });
    await expect(listStaffMembers({ page: 1, limit: 20 })).resolves.toEqual({
      staff,
      pagination: { page: 1, totalPages: 2 },
    });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/staff?page=1&limit=20');
  });

  it('rejects invalid staff list response instead of fabricating data', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: {} });
    await expect(listStaffMembers()).rejects.toThrow(
      'Invalid staff directory response',
    );
  });
});

describe('DDP-094 provisional staff management service', () => {
  const member = {
    id: 'staff-1',
    name: 'Nimal Perera',
    role: 'BRANCH_MANAGER',
  };

  it('loads a staff member by ID', async () => {
    apiClient.get.mockResolvedValue({ success: true, data: member });
    await expect(getStaffMember('staff-1')).resolves.toEqual(member);
    expect(apiClient.get).toHaveBeenCalledWith('/admin/staff/staff-1');
  });

  it('uses separate profile, role and branch update endpoints', async () => {
    apiClient.patch.mockResolvedValue({ success: true, data: member });
    await updateStaffProfile('staff-1', { name: 'Nimal Perera' });
    await updateStaffRole('staff-1', 'OPTOMETRIST');
    await reassignStaffBranch('staff-1', 'branch-2');
    expect(apiClient.patch).toHaveBeenNthCalledWith(1, '/admin/staff/staff-1', {
      name: 'Nimal Perera',
    });
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      '/admin/staff/staff-1/role',
      { role: 'OPTOMETRIST' },
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      3,
      '/admin/staff/staff-1/branch',
      { branchId: 'branch-2' },
    );
  });

  it('rejects backend replies without successful record confirmation', async () => {
    apiClient.patch.mockResolvedValue({ success: true, data: {} });
    await expect(updateStaffRole('staff-1', 'OPTOMETRIST')).rejects.toThrow(
      /not confirmed/,
    );
  });
});

describe('DDP-094 provisional staff activation service', () => {
  it('sends status changes only through the management PATCH endpoint', async () => {
    const record = { id: 'staff-1', name: 'Nimal', isActive: false };
    apiClient.patch.mockResolvedValue({ success: true, data: record });
    await expect(updateStaffStatus('staff-1', false)).resolves.toEqual(record);
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/admin/staff/staff-1/status',
      {
        isActive: false,
      },
    );
  });

  it('rejects malformed requests and unconfirmed backend replies', async () => {
    await expect(updateStaffStatus('staff-1', 'inactive')).rejects.toThrow(
      /Invalid staff activation/,
    );
    apiClient.patch.mockResolvedValue({
      success: true,
      data: { id: 'staff-1', isActive: true },
    });
    await expect(updateStaffStatus('staff-1', false)).rejects.toThrow(
      /not confirmed/,
    );
    apiClient.patch.mockResolvedValue({
      success: true,
      data: { id: 'staff-2', isActive: false },
    });
    await expect(updateStaffStatus('staff-1', false)).rejects.toThrow(
      /not confirmed/,
    );
  });
});

// DDP-094 merged backend API contract regression.
describe('DDP-094 merged backend API contract regression', () => {
  it('reads top-level pagination from GET /admin/staff without losing paging controls', async () => {
    const staff = [{ id: 'staff-1', name: 'Nimal Perera', isActive: true }];
    const pagination = { page: 2, limit: 20, total: 25, totalPages: 2 };
    apiClient.get.mockResolvedValue({ success: true, data: staff, pagination });

    await expect(listStaffMembers({ page: 2, limit: 20 })).resolves.toEqual({
      staff,
      pagination,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/admin/staff?page=2&limit=20');
  });

  it('submits a null branchId to clear staff branch assignment', async () => {
    apiClient.patch.mockResolvedValue({
      success: true,
      data: { id: 'staff-1', branchId: null, isActive: true },
    });
    await expect(reassignStaffBranch('staff-1', null)).resolves.toMatchObject({
      id: 'staff-1',
      branchId: null,
    });
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/admin/staff/staff-1/branch',
      {
        branchId: null,
      },
    );
  });
});

describe('DDP-094 Staff status and search query contract', () => {
  it('passes filter and encoded search to the backend without losing pagination', async () => {
    const staff = [{ id: 'staff-7', name: 'Saman', isActive: false }];
    const pagination = { page: 2, limit: 20, total: 21, totalPages: 2 };
    apiClient.get.mockResolvedValue({ success: true, data: staff, pagination });
    await expect(
      listStaffMembers({
        page: 2,
        limit: 20,
        isActive: false,
        search: ' Saman Silva ',
      }),
    ).resolves.toEqual({ staff, pagination });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/admin/staff?page=2&limit=20&isActive=false&search=Saman+Silva',
    );
  });
});
