import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminStaffCreatePage from '../src/pages/AdminStaffCreatePage';
import { provisionStaff } from '../src/services/staffAdminService';

const mockLogout = vi.hoisted(() => vi.fn());
const mockBranchState = vi.hoisted(() => ({ unauthorized: false }));

vi.mock('../src/services/staffAdminService', () => ({
  provisionStaff: vi.fn(),
}));
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ logout: mockLogout }),
}));
vi.mock('../src/hooks/useBranches', () => ({
  default: () => ({
    branches: [
      {
        id: '507f1f77bcf86cd799439011',
        address: '15 Main Street',
        contactNumber: '0331234567',
      },
    ],
    loading: false,
    error: null,
    retry: vi.fn(),
    unauthorized: mockBranchState.unauthorized,
  }),
}));

function showPage() {
  render(
    <MemoryRouter initialEntries={['/admin/staff/new']}>
      <Routes>
        <Route path="/admin/staff/new" element={<AdminStaffCreatePage />} />
        <Route path="/login" element={<div>Login screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function completeForm() {
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: 'Nimal Perera' },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'NIMAL@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/phone number/i), {
    target: { value: '0771234567' },
  });
  fireEvent.change(screen.getByLabelText(/^address/i), {
    target: { value: '15 Main Street' },
  });
  fireEvent.change(screen.getByLabelText(/designation/i), {
    target: { value: 'OPTOMETRIST' },
  });
  fireEvent.change(screen.getByLabelText(/initial password/i), {
    target: { value: 'Secure123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'Secure123' },
  });
}

describe('AdminStaffCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBranchState.unauthorized = false;
  });

  it('shows only the three approved staff roles and an optional Branch selector', () => {
    showPage();
    expect(
      screen.getByRole('heading', { name: /add new staff member/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Branch Manager' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Optometrist' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Branch Assistant' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'System Admin' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/branch \(optional\)/i)).not.toBeRequired();
  });

  it('validates required fields before attempting to submit', () => {
    showPage();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByText(/enter a valid name/i)).toBeInTheDocument();
    expect(provisionStaff).not.toHaveBeenCalled();
  });

  it('submits the approved fields, excludes confirmPassword and shows safe success', async () => {
    provisionStaff.mockResolvedValue({
      id: 'staff-id',
      name: 'Nimal Perera',
      email: 'nimal@example.com',
      phone: '0771234567',
      address: '15 Main Street',
      role: 'OPTOMETRIST',
      branchId: null,
    });
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => expect(provisionStaff).toHaveBeenCalledTimes(1));
    expect(provisionStaff).toHaveBeenCalledWith({
      name: 'Nimal Perera',
      email: 'nimal@example.com',
      phone: '0771234567',
      address: '15 Main Street',
      role: 'OPTOMETRIST',
      password: 'Secure123',
    });
    expect(
      await screen.findByRole('heading', {
        name: 'Staff Account Created',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Secure123')).not.toBeInTheDocument();
    expect(document.querySelector('.admin-staff__success-mark')).toBeNull();
    expect(screen.getByText('nimal@example.com')).toBeInTheDocument();
  });

  it('displays duplicate identity conflicts without showing false success', async () => {
    provisionStaff.mockRejectedValue(
      Object.assign(new Error('Duplicate'), { status: 409 }),
    );
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already exists/i,
    );
    expect(
      screen.queryByRole('heading', { name: 'Staff Account Created' }),
    ).not.toBeInTheDocument();
  });
  it('prevents repeat requests while staff creation is pending', async () => {
    let finish;
    provisionStaff.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    const waiting = screen.getByRole('button', { name: 'Creating Account...' });
    expect(waiting).toBeDisabled();
    fireEvent.submit(waiting.closest('form'));
    expect(provisionStaff).toHaveBeenCalledTimes(1);
    finish({
      id: 'staff-id',
      name: 'Nimal Perera',
      email: 'nimal@example.com',
      role: 'OPTOMETRIST',
      branchId: null,
    });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Staff Account Created',
      }),
    ).toBeInTheDocument();
  });

  it('handles staff creation 401 by logging out and returning to Login', async () => {
    provisionStaff.mockRejectedValue(
      Object.assign(new Error('Expired session'), { status: 401 }),
    );
    showPage();
    completeForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('logs out for an unauthorized Branch lookup instead of showing retryable error', async () => {
    mockBranchState.unauthorized = true;
    showPage();
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it.each([
    [403, 'Forbidden', /do not have permission/i],
    [422, 'Staff data is invalid.', /staff data is invalid/i],
    [0, 'Network unavailable', /unable to reach the server/i],
    [500, 'Unexpected database failure', /staff account could not be created/i],
  ])(
    'handles staff creation error status %s safely',
    async (status, message, expected) => {
      provisionStaff.mockRejectedValue(
        Object.assign(new Error(message), { status }),
      );
      showPage();
      completeForm();
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(expected);
      expect(
        screen.queryByRole('heading', {
          level: 1,
          name: 'Staff Account Created',
        }),
      ).not.toBeInTheDocument();
    },
  );
});
