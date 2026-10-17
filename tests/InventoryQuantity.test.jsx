import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '../src/pages/InventoryPage';
import {
  getBranchInventory,
  updateInventoryQuantity,
} from '../src/services/inventoryService';

const state = vi.hoisted(() => ({
  user: { role: 'BRANCH_MANAGER', branchId: 'branch-1' },
}));

vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ user: state.user }),
}));
vi.mock('../src/hooks/useBranches', () => ({
  useBranches: () => ({
    branches: [
      { id: 'branch-1', address: 'Kandy Road' },
      { id: 'branch-2', address: 'Galle Road' },
    ],
    loading: false,
    error: null,
    retry: vi.fn(),
    unauthorized: false,
  }),
}));
vi.mock('../src/services/inventoryService', () => ({
  getBranchInventory: vi.fn(),
  updateInventoryQuantity: vi.fn(),
  getActiveReorderAlerts: vi
    .fn()
    .mockResolvedValue({ alerts: [], total: 0, page: 1, limit: 20 }),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  overrideInventoryPrice: vi.fn(),
}));

const item = {
  _id: 'item-1',
  itemName: 'Blue Frame',
  category: 'Men',
  brand: 'Nova',
  price: 1500,
  quantity: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { role: 'BRANCH_MANAGER', branchId: 'branch-1' };
});

describe('Inventory quantity management', () => {
  it('lets Branch Manager set an absolute quantity and refreshes from backend after success', async () => {
    getBranchInventory
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([{ ...item, quantity: 4 }]);
    updateInventoryQuantity.mockResolvedValueOnce({ ...item, quantity: 4 });

    render(<InventoryPage />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Update quantity for Blue Frame',
      }),
    );
    const input = screen.getByRole('spinbutton', { name: 'New Quantity' });
    expect(input).toHaveValue(7);
    await user.clear(input);
    await user.type(input, '4');
    await user.click(screen.getByRole('button', { name: 'Save Quantity' }));

    await waitFor(() =>
      expect(updateInventoryQuantity).toHaveBeenCalledWith('item-1', 4),
    );
    await waitFor(() => expect(getBranchInventory).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole('region', { name: 'Update inventory quantity' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText('4', { selector: 'td' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['', ''],
    ['-2', '-2'],
    ['2.5', '2.5'],
  ])(
    'rejects empty, negative, and fractional inputs (%s) without any request',
    async (_, value) => {
      getBranchInventory.mockResolvedValueOnce([item]);
      render(<InventoryPage />);
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', {
          name: 'Update quantity for Blue Frame',
        }),
      );
      const input = screen.getByRole('spinbutton', { name: 'New Quantity' });
      await user.clear(input);
      if (value) await user.type(input, value);
      await user.click(screen.getByRole('button', { name: 'Save Quantity' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'non-negative whole-number quantity',
      );
      expect(updateInventoryQuantity).not.toHaveBeenCalled();
    },
  );

  it('prevents repeated changes while saving and waits for authoritative refresh', async () => {
    let finish;
    getBranchInventory
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([{ ...item, quantity: 3 }]);
    updateInventoryQuantity.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<InventoryPage />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Update quantity for Blue Frame',
      }),
    );
    await user.clear(screen.getByRole('spinbutton', { name: 'New Quantity' }));
    await user.type(
      screen.getByRole('spinbutton', { name: 'New Quantity' }),
      '3',
    );
    await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
    expect(
      await screen.findByRole('button', { name: 'Saving...' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    expect(updateInventoryQuantity).toHaveBeenCalledTimes(1);
    expect(screen.getByText('7', { selector: 'td' })).toBeInTheDocument();
    finish({ ...item, quantity: 3 });
    await waitFor(() => expect(getBranchInventory).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText('3', { selector: 'td' }),
    ).toBeInTheDocument();
  });

  it('preserves old quantity and displays safe 403 feedback if backend denies update', async () => {
    getBranchInventory.mockResolvedValueOnce([item]);
    updateInventoryQuantity.mockRejectedValueOnce(
      Object.assign(new Error('backend details'), { status: 403 }),
    );
    render(<InventoryPage />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: 'Update quantity for Blue Frame',
      }),
    );
    await user.clear(screen.getByRole('spinbutton', { name: 'New Quantity' }));
    await user.type(
      screen.getByRole('spinbutton', { name: 'New Quantity' }),
      '3',
    );
    await user.click(screen.getByRole('button', { name: 'Save Quantity' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(screen.getByText('7', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByText('backend details')).not.toBeInTheDocument();
    expect(getBranchInventory).toHaveBeenCalledTimes(1);
  });

  it('does not offer quantity controls to System Admin', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };
    getBranchInventory.mockResolvedValueOnce([item]);
    render(<InventoryPage />);
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Branch' }),
        'branch-1',
      );
    expect(
      await screen.findByRole('button', { name: 'Edit price for Blue Frame' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /update quantity/i }),
    ).not.toBeInTheDocument();
    expect(updateInventoryQuantity).not.toHaveBeenCalled();
  });
});
