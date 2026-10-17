import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '../src/pages/InventoryPage';
import {
  getBranchInventory,
  createInventoryItem,
  updateInventoryItem,
  overrideInventoryPrice,
} from '../src/services/inventoryService';

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
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  overrideInventoryPrice: vi.fn(),
  updateInventoryQuantity: vi.fn(),
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

describe('Inventory create/edit permissions and operations', () => {
  const item = {
    _id: 'item-1',
    itemName: 'Blue Frame',
    category: 'Men',
    brand: 'Nova',
    quantity: 7,
    price: 1500,
  };

  it('lets a manager create an item with approved fields and refreshes after backend confirmation', async () => {
    getBranchInventory.mockResolvedValue([]);
    createInventoryItem.mockResolvedValue({ _id: 'new-item' });
    render(<InventoryPage />);
    expect(
      await screen.findByText('No inventory items found for this branch.'),
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Add Inventory Item' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Item Name' }),
      '  Pilot  ',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Category' }),
      '  Frames  ',
    );
    await user.type(screen.getByRole('textbox', { name: 'Brand' }), '  Nova  ');
    await user.type(
      screen.getByRole('spinbutton', { name: 'Price (LKR)' }),
      '2500',
    );
    await user.clear(
      screen.getByRole('spinbutton', { name: 'Initial Quantity' }),
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Initial Quantity' }),
      '3',
    );
    await user.click(screen.getByRole('button', { name: 'Add Item' }));

    await waitFor(() =>
      expect(createInventoryItem).toHaveBeenCalledWith('branch-1', {
        itemName: 'Pilot',
        category: 'Frames',
        brand: 'Nova',
        price: 2500,
        quantity: 3,
      }),
    );
    expect(
      await screen.findByText('Inventory item added.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(getBranchInventory).toHaveBeenCalledTimes(2));
  });

  it('rejects invalid creation values without a backend request', async () => {
    getBranchInventory.mockResolvedValueOnce([]);
    render(<InventoryPage />);
    expect(
      await screen.findByText('No inventory items found for this branch.'),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Add Inventory Item' }),
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Price (LKR)' }),
      '-5',
    );
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(screen.getByRole('alert')).toHaveTextContent('non-negative price');
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('rejects fractional or negative initial quantities', async () => {
    getBranchInventory.mockResolvedValueOnce([]);
    render(<InventoryPage />);
    expect(
      await screen.findByText('No inventory items found for this branch.'),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Add Inventory Item' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Item Name' }),
      'Frame',
    );
    await user.type(screen.getByRole('textbox', { name: 'Category' }), 'Men');
    await user.type(screen.getByRole('textbox', { name: 'Brand' }), 'Nova');
    await user.type(
      screen.getByRole('spinbutton', { name: 'Price (LKR)' }),
      '100',
    );
    await user.clear(
      screen.getByRole('spinbutton', { name: 'Initial Quantity' }),
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Initial Quantity' }),
      '1.5',
    );
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'whole-number quantity',
    );
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('disables repeated submissions while a creation request is pending', async () => {
    let finishCreate;
    getBranchInventory.mockResolvedValue([]);
    createInventoryItem.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCreate = resolve;
        }),
    );
    render(<InventoryPage />);
    expect(
      await screen.findByText('No inventory items found for this branch.'),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Add Inventory Item' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Item Name' }),
      'Frame',
    );
    await user.type(screen.getByRole('textbox', { name: 'Category' }), 'Men');
    await user.type(screen.getByRole('textbox', { name: 'Brand' }), 'Nova');
    await user.type(
      screen.getByRole('spinbutton', { name: 'Price (LKR)' }),
      '100',
    );
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(
      await screen.findByRole('button', { name: 'Saving...' }),
    ).toBeDisabled();
    expect(createInventoryItem).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishCreate({ _id: 'new-item' });
    });
    expect(
      await screen.findByText('Inventory item added.'),
    ).toBeInTheDocument();
  });

  it('lets a manager edit metadata but not quantity within this form', async () => {
    getBranchInventory.mockResolvedValue([item]);
    updateInventoryItem.mockResolvedValue({ ...item, price: 1600 });
    render(<InventoryPage />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Blue Frame' }),
    );
    expect(
      screen.queryByRole('spinbutton', { name: 'Initial Quantity' }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByRole('spinbutton', { name: 'Price (LKR)' }));
    await user.type(
      screen.getByRole('spinbutton', { name: 'Price (LKR)' }),
      '1600',
    );
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(updateInventoryItem).toHaveBeenCalledWith('item-1', {
        itemName: 'Blue Frame',
        category: 'Men',
        brand: 'Nova',
        price: 1600,
      }),
    );
    expect(createInventoryItem).not.toHaveBeenCalled();
    expect(overrideInventoryPrice).not.toHaveBeenCalled();
  });

  it('restricts System Admin to price-only override on selected branch', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };
    getBranchInventory.mockResolvedValue([item]);
    overrideInventoryPrice.mockResolvedValue({ ...item, price: 1900 });
    render(<InventoryPage />);
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Branch' }),
      'branch-2',
    );
    await user.click(
      await screen.findByRole('button', { name: 'Edit price for Blue Frame' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Add Inventory Item' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Item Name' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Category' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', { name: 'Initial Quantity' }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByRole('spinbutton', { name: 'Price (LKR)' }));
    await user.type(
      screen.getByRole('spinbutton', { name: 'Price (LKR)' }),
      '1900',
    );
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(overrideInventoryPrice).toHaveBeenCalledWith('item-1', 1900),
    );
    expect(updateInventoryItem).not.toHaveBeenCalled();
    expect(createInventoryItem).not.toHaveBeenCalled();
  });

  it('keeps authoritative inventory unchanged when update fails and shows safe feedback', async () => {
    getBranchInventory.mockResolvedValueOnce([item]);
    updateInventoryItem.mockRejectedValueOnce(
      Object.assign(new Error('Sensitive backend error'), { status: 403 }),
    );
    render(<InventoryPage />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edit Blue Frame' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(
      screen.getByText('Blue Frame', { selector: 'td' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Sensitive backend error'),
    ).not.toBeInTheDocument();
    expect(getBranchInventory).toHaveBeenCalledTimes(1);
  });
});
