import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminStaffManagementPage from '../src/pages/AdminStaffManagementPage';
import {
  listStaffMembers,
  getStaffMember,
  updateStaffStatus,
} from '../src/services/staffAdminService';

const state = vi.hoisted(() => ({
  logout: vi.fn(),
  navigate: vi.fn(),
  branchesUnauthorized: false,
  branches: [{ id: 'branch-1', address: 'Gampaha Main Branch' }],
}));
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ logout: state.logout }),
}));
vi.mock('../src/hooks/useBranches', () => ({
  useBranches: () => ({
    branches: state.branches,
    unauthorized: state.branchesUnauthorized,
  }),
}));
vi.mock('react-router-dom', async (original) => ({
  ...(await original()),
  useNavigate: () => state.navigate,
}));
vi.mock('../src/services/staffAdminService', () => ({
  listStaffMembers: vi.fn(),
  getStaffMember: vi.fn(),
  updateStaffProfile: vi.fn(),
  updateStaffRole: vi.fn(),
  reassignStaffBranch: vi.fn(),
  updateStaffStatus: vi.fn(),
}));

const entries = [
  {
    id: 'staff-1',
    name: 'Nimal Perera',
    email: 'nimal@example.com',
    role: 'BRANCH_MANAGER',
    branchId: 'branch-1',
    isActive: true,
    passwordHash: 'TOP_SECRET',
  },
  {
    id: 'staff-2',
    name: 'Saman Perera',
    email: 'saman@example.com',
    role: 'OPTOMETRIST',
    branchId: null,
    isActive: false,
  },
];
function show() {
  return render(
    <MemoryRouter>
      <AdminStaffManagementPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.branchesUnauthorized = false;
  state.branches = [{ id: 'branch-1', address: 'Gampaha Main Branch' }];
  listStaffMembers.mockResolvedValue({
    staff: entries,
    pagination: { page: 1, totalPages: 2 },
  });
});

describe('DDP-094 Staff Management List', () => {
  it('asks for confirmation before deactivation, then refreshes only after backend success', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    updateStaffStatus.mockResolvedValue({ ...entries[0], isActive: false });
    listStaffMembers
      .mockResolvedValueOnce({ staff: entries, pagination: null })
      .mockResolvedValueOnce({
        staff: [{ ...entries[0], isActive: false }, entries[1]],
        pagination: null,
      });
    show();
    await screen.findByText('Nimal Perera');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Deactivate Nimal Perera' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(updateStaffStatus).toHaveBeenCalledWith('staff-1', false),
    );
    expect(
      await screen.findByText('Staff account deactivated successfully.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(listStaffMembers).toHaveBeenCalledTimes(2));
    confirm.mockRestore();
  });

  it('does not deactivate when administrator cancels the confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    show();
    await screen.findByText('Nimal Perera');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Deactivate Nimal Perera' }));
    expect(updateStaffStatus).not.toHaveBeenCalled();
    expect(listStaffMembers).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('activates an inactive account and reloads the list', async () => {
    updateStaffStatus.mockResolvedValue({ ...entries[1], isActive: true });
    show();
    await screen.findByText('Saman Perera');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Activate Saman Perera' }));
    await waitFor(() =>
      expect(updateStaffStatus).toHaveBeenCalledWith('staff-2', true),
    );
    expect(
      await screen.findByText('Staff account activated successfully.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(listStaffMembers).toHaveBeenCalledTimes(2));
  });

  it('does not show action controls when backend omits activation status', async () => {
    listStaffMembers.mockResolvedValue({
      staff: [{ ...entries[0], isActive: undefined, active: undefined }],
      pagination: null,
    });
    show();
    await screen.findByText('Nimal Perera');
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deactivate Nimal Perera' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Activate Nimal Perera' }),
    ).not.toBeInTheDocument();
  });

  it('handles protected-account conflict without claiming a successful change', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    updateStaffStatus.mockRejectedValue(
      Object.assign(new Error('PRIVATE_BACKEND_DETAILS'), { status: 409 }),
    );
    show();
    await screen.findByText('Nimal Perera');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Deactivate Nimal Perera' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cannot be changed',
    );
    expect(
      screen.queryByText('PRIVATE_BACKEND_DETAILS'),
    ).not.toBeInTheDocument();
    expect(listStaffMembers).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('uses shared logout on a 401 status mutation', async () => {
    updateStaffStatus.mockRejectedValue(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    show();
    await screen.findByText('Saman Perera');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Activate Saman Perera' }));
    await waitFor(() => expect(state.logout).toHaveBeenCalledTimes(1));
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });
  it('opens the staff editor from a directory row', async () => {
    getStaffMember.mockResolvedValue({
      ...entries[0],
      phone: '0771234567',
      address: 'Colombo 07',
    });
    show();
    await screen.findByText('Nimal Perera');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Edit Nimal Perera' }));
    expect(
      await screen.findByRole('region', { name: 'Edit staff member' }),
    ).toBeInTheDocument();
    expect(getStaffMember).toHaveBeenCalledWith('staff-1');
  });
  it('renders the approved staff fields, mapped branches and active status without secrets', async () => {
    show();
    expect(await screen.findByText('Nimal Perera')).toBeInTheDocument();
    expect(screen.getByText('nimal@example.com')).toBeInTheDocument();
    expect(screen.getByText('Branch Manager')).toBeInTheDocument();
    expect(screen.getByText('Gampaha Main Branch')).toBeInTheDocument();
    expect(screen.getByText('Not assigned')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByText('TOP_SECRET')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Add Staff Member' }),
    ).toHaveAttribute('href', '/admin/staff/new');
    expect(listStaffMembers).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      isActive: true,
      search: '',
    });
  });

  it('shows loading state while data is pending', () => {
    listStaffMembers.mockReturnValue(new Promise(() => {}));
    show();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading staff members',
    );
    expect(screen.queryByText('Nimal Perera')).not.toBeInTheDocument();
  });

  it('shows a truthful empty state', async () => {
    listStaffMembers.mockResolvedValue({ staff: [], pagination: null });
    show();
    expect(
      await screen.findByText('No staff members found.'),
    ).toBeInTheDocument();
  });

  it('supports server-side paging and never leaves previous-page data on screen', async () => {
    listStaffMembers
      .mockResolvedValueOnce({
        staff: entries,
        pagination: { page: 1, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        staff: [
          {
            id: 'staff-3',
            name: 'Third Staff',
            role: 'BRANCH_ASSISTANT',
            isActive: true,
          },
        ],
        pagination: { page: 2, totalPages: 2 },
      });
    show();
    await screen.findByText('Nimal Perera');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Third Staff')).toBeInTheDocument();
    expect(screen.queryByText('Nimal Perera')).not.toBeInTheDocument();
    expect(listStaffMembers).toHaveBeenLastCalledWith({
      page: 2,
      limit: 20,
      isActive: true,
      search: '',
    });
  });

  it('shows safe error and retries', async () => {
    listStaffMembers
      .mockRejectedValueOnce(new Error('PRIVATE_STACK'))
      .mockResolvedValueOnce({ staff: entries, pagination: null });
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load staff members',
    );
    expect(screen.queryByText('PRIVATE_STACK')).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nimal Perera')).toBeInTheDocument();
    expect(listStaffMembers).toHaveBeenCalledTimes(2);
  });

  it('provides honest backend-unavailable feedback', async () => {
    listStaffMembers.mockRejectedValueOnce(
      Object.assign(new Error('missing endpoint'), { status: 404 }),
    );
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'not available yet',
    );
  });

  it('shows forbidden message without a retry action', async () => {
    listStaffMembers.mockRejectedValueOnce(
      Object.assign(new Error('secret'), { status: 403 }),
    );
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('uses existing logout/login flow on 401', async () => {
    listStaffMembers.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    show();
    await waitFor(() => expect(state.logout).toHaveBeenCalled());
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(screen.queryByText('Nimal Perera')).not.toBeInTheDocument();
  });

  it('handles expired branch lookup session', async () => {
    state.branchesUnauthorized = true;
    show();
    await waitFor(() => expect(state.logout).toHaveBeenCalled());
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});

// DDP-094 Admin UI accessibility/polish regression.
it('renders the staff editor before the table when an Edit action is clicked', async () => {
  getStaffMember.mockResolvedValue({
    ...entries[0],
    phone: '0771234567',
    address: 'Colombo 07',
  });
  show();
  await screen.findByText('Nimal Perera');
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Edit Nimal Perera' }));
  const editor = await screen.findByRole('region', {
    name: 'Edit staff member',
  });
  const directory = screen.getByRole('region', {
    name: 'Staff directory table',
  });
  expect(
    Boolean(
      editor.compareDocumentPosition(directory) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBe(true);
});

// DDP-094 staff status-tab and cross-tab search regression.
it('searches staff on both status tabs via the paginated backend filter', async () => {
  listStaffMembers.mockImplementation(async ({ isActive, search }) => ({
    staff: entries.filter(
      (entry) =>
        entry.isActive === isActive &&
        (!search ||
          (entry.name + ' ' + entry.email)
            .toLowerCase()
            .includes(search.toLowerCase())),
    ),
    pagination: { page: 1, totalPages: 1 },
  }));
  show();
  expect(await screen.findByText('Nimal Perera')).toBeInTheDocument();
  expect(screen.queryByText('Saman Perera')).not.toBeInTheDocument();
  await userEvent
    .setup()
    .type(screen.getByRole('searchbox', { name: 'Search staff' }), 'Saman');
  await waitFor(() =>
    expect(screen.queryByText('Nimal Perera')).not.toBeInTheDocument(),
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Inactive Staff' }));
  expect(await screen.findByText('Saman Perera')).toBeInTheDocument();
  expect(listStaffMembers).toHaveBeenLastCalledWith({
    page: 1,
    limit: 20,
    isActive: false,
    search: 'Saman',
  });
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Active Staff' }));
  expect(
    await screen.findByText('No staff members found.'),
  ).toBeInTheDocument();
});
