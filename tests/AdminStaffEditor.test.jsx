import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminStaffEditor from '../src/pages/AdminStaffEditor';
import {
  getStaffMember,
  updateStaffProfile,
  updateStaffRole,
  reassignStaffBranch,
} from '../src/services/staffAdminService';

const state = vi.hoisted(() => ({ logout: vi.fn(), navigate: vi.fn() }));
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ logout: state.logout }),
}));
vi.mock('react-router-dom', async (original) => ({
  ...(await original()),
  useNavigate: () => state.navigate,
}));
vi.mock('../src/services/staffAdminService', () => ({
  getStaffMember: vi.fn(),
  updateStaffProfile: vi.fn(),
  updateStaffRole: vi.fn(),
  reassignStaffBranch: vi.fn(),
}));

const record = {
  id: 'staff-1',
  name: 'Nimal Perera',
  email: 'nimal@example.com',
  phone: '0771234567',
  address: 'Colombo 07',
  role: 'BRANCH_MANAGER',
  branchId: 'branch-1',
  passwordHash: 'MUST_NOT_SHOW',
};
const branches = [
  { id: 'branch-1', address: 'Colombo Main' },
  { id: 'branch-2', address: 'Gampaha Main' },
];
let onClose;
let onUpdated;
function show() {
  return render(
    <MemoryRouter>
      <AdminStaffEditor
        staffId="staff-1"
        branches={branches}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  onClose = vi.fn();
  onUpdated = vi.fn();
  getStaffMember.mockResolvedValue(record);
  updateStaffProfile.mockResolvedValue({ ...record, name: 'Nimal Updated' });
  updateStaffRole.mockResolvedValue({ ...record, role: 'OPTOMETRIST' });
  reassignStaffBranch.mockResolvedValue({ ...record, branchId: 'branch-2' });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('DDP-094 staff editing', () => {
  it('fetches the exact staff record and prepopulates only approved fields', async () => {
    show();
    expect(await screen.findByDisplayValue('Nimal Perera')).toBeInTheDocument();
    expect(screen.getByDisplayValue('nimal@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0771234567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Colombo 07')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveValue(
      'BRANCH_MANAGER',
    );
    expect(screen.getByRole('combobox', { name: 'Assign branch' })).toHaveValue(
      'branch-1',
    );
    expect(screen.queryByText('MUST_NOT_SHOW')).not.toBeInTheDocument();
    expect(getStaffMember).toHaveBeenCalledWith('staff-1');
  });

  it('validates profile edits and saves only allowed fields', async () => {
    show();
    const name = await screen.findByRole('textbox', { name: 'Full name' });
    fireEvent.change(name, { target: { value: 'Nimal Updated' } });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() =>
      expect(updateStaffProfile).toHaveBeenCalledWith('staff-1', {
        name: 'Nimal Updated',
        email: 'nimal@example.com',
        phone: '0771234567',
        address: 'Colombo 07',
      }),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  });

  it('rejects invalid profile and does not call the backend', async () => {
    show();
    const email = await screen.findByRole('textbox', { name: 'Email address' });
    fireEvent.change(email, { target: { value: 'invalid-email' } });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save details' }));
    expect(
      screen.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(updateStaffProfile).not.toHaveBeenCalled();
  });

  it('does not submit unchanged records', async () => {
    show();
    await screen.findByDisplayValue('Nimal Perera');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save details' }));
    expect(screen.getByText('No profile changes to save.')).toBeInTheDocument();
    expect(updateStaffProfile).not.toHaveBeenCalled();
  });

  it('confirms a sensitive role change before calling the role endpoint', async () => {
    show();
    const roles = await screen.findByRole('combobox', { name: 'Role' });
    await userEvent.setup().selectOptions(roles, 'OPTOMETRIST');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Change role' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(updateStaffRole).toHaveBeenCalledWith('staff-1', 'OPTOMETRIST'),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  });

  it('cancels a role change if administrator declines confirmation', async () => {
    window.confirm.mockReturnValue(false);
    show();
    await screen.findByDisplayValue('Nimal Perera');
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Role' }),
        'OPTOMETRIST',
      );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Change role' }));
    expect(updateStaffRole).not.toHaveBeenCalled();
  });

  it('confirms reassignment and sends the authoritative branch ID', async () => {
    show();
    await screen.findByDisplayValue('Nimal Perera');
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Assign branch' }),
        'branch-2',
      );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Reassign branch' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(reassignStaffBranch).toHaveBeenCalledWith('staff-1', 'branch-2'),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  });

  it('does not submit unauthorized errors and does not show raw server messages', async () => {
    updateStaffRole.mockRejectedValueOnce(
      Object.assign(new Error('INTERNAL_PRIVATE'), { status: 403 }),
    );
    show();
    await screen.findByDisplayValue('Nimal Perera');
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Role' }),
        'OPTOMETRIST',
      );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Change role' }));
    expect(
      await screen.findByText(
        'You do not have permission to manage this staff member.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_PRIVATE')).not.toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('uses existing logout behavior on expired details request', async () => {
    getStaffMember.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    show();
    await waitFor(() => expect(state.logout).toHaveBeenCalledTimes(1));
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});

// DDP-094 clearing a branch assignment (backend accepts branchId: null).
describe('DDP-094 clearing a branch assignment', () => {
  it('allows the admin to unassign a branch without inventing a branch ID', async () => {
    show();
    await screen.findByDisplayValue('Nimal Perera');
    fireEvent.change(screen.getByRole('combobox', { name: 'Assign branch' }), {
      target: { value: '' },
    });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Reassign branch' }));
    await waitFor(() =>
      expect(reassignStaffBranch).toHaveBeenCalledWith('staff-1', null),
    );
    expect(window.confirm).toHaveBeenCalled();
  });
});
