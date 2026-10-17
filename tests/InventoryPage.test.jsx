import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '../src/pages/InventoryPage';
import { getBranchInventory } from '../src/services/inventoryService';

const state = vi.hoisted(() => ({
  user: { role: 'BRANCH_MANAGER', branchId: 'branch-1' },
  branches: [
    { id: 'branch-1', address: 'Kandy Road' },
    { id: 'branch-2', address: 'Galle Road' },
  ],
}));

vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ user: state.user }),
}));
vi.mock('../src/hooks/useBranches', () => ({
  useBranches: () => ({
    branches: state.branches,
    loading: false,
    error: null,
    retry: vi.fn(),
    unauthorized: false,
  }),
}));
vi.mock('../src/services/inventoryService', () => ({
  getBranchInventory: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { role: 'BRANCH_MANAGER', branchId: 'branch-1' };
  state.branches = [
    { id: 'branch-1', address: 'Kandy Road' },
    { id: 'branch-2', address: 'Galle Road' },
  ];
});

describe('Inventory overview', () => {
  it('loads a manager assigned branch without allowing a different branch selection', async () => {
    getBranchInventory.mockResolvedValueOnce([
      {
        _id: 'item-1',
        itemName: 'Blue Frame',
        category: 'Men',
        brand: 'Nova',
        quantity: 7,
        price: 1500,
      },
    ]);
    render(<InventoryPage />);
    expect(await screen.findByText('Blue Frame')).toBeInTheDocument();
    expect(screen.getByText('Kandy Road')).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Branch' }),
    ).not.toBeInTheDocument();
    expect(getBranchInventory).toHaveBeenCalledWith('branch-1');
  });

  it('lets an admin select a branch before inventory retrieval', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };
    getBranchInventory.mockResolvedValueOnce([]);
    render(<InventoryPage />);
    expect(getBranchInventory).not.toHaveBeenCalled();
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Branch' }),
        'branch-2',
      );
    expect(
      await screen.findByText('No inventory items found for this branch.'),
    ).toBeInTheDocument();
    expect(getBranchInventory).toHaveBeenCalledWith('branch-2');
  });

  it('shows an empty state for an authorized branch with no items', async () => {
    getBranchInventory.mockResolvedValueOnce([]);
    render(<InventoryPage />);
    expect(
      await screen.findByText('No inventory items found for this branch.'),
    ).toBeInTheDocument();
  });

  it('displays safe access-denied feedback for backend 403', async () => {
    getBranchInventory.mockRejectedValueOnce(
      Object.assign(new Error('Internal details'), { status: 403 }),
    );
    render(<InventoryPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(screen.queryByText('Internal details')).not.toBeInTheDocument();
  });

  it('refreshes the authoritative backend data on demand', async () => {
    getBranchInventory
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { _id: 'item-2', itemName: 'Updated Frame', quantity: 4 },
      ]);
    render(<InventoryPage />);
    expect(
      await screen.findByText('No inventory items found for this branch.'),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Updated Frame')).toBeInTheDocument();
    await waitFor(() => expect(getBranchInventory).toHaveBeenCalledTimes(2));
  });

  it('does not request data when manager has no assigned branch', () => {
    state.user = { role: 'BRANCH_MANAGER' };
    render(<InventoryPage />);
    expect(
      screen.getByText('No assigned branch is available for this account.'),
    ).toBeInTheDocument();
    expect(getBranchInventory).not.toHaveBeenCalled();
  });
});
