import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import InventoryReportPage from '../src/pages/InventoryReportPage';
import { getInventoryReport } from '../src/services/reportService';

const state = vi.hoisted(() => ({
  user: { role: 'BRANCH_MANAGER', branchId: '507f1f77bcf86cd799439011' },
  unauthorized: false,
  logout: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ user: state.user, logout: state.logout }),
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => state.navigate,
}));
vi.mock('../src/hooks/useBranches', () => ({
  useBranches: () => ({
    branches: [
      { id: '507f1f77bcf86cd799439011', address: 'Kandy Road' },
      { id: '507f191e810c19729de860ea', address: 'Galle Road' },
    ],
    loading: false,
    error: null,
    retry: vi.fn(),
    unauthorized: state.unauthorized,
  }),
}));
vi.mock('../src/services/reportService', () => ({
  getInventoryReport: vi.fn(),
  getInventoryItems: vi.fn().mockResolvedValue({
    items: [],
    pagination: { page: 1, limit: 20, totalRecords: 0, totalPages: 0 },
  }),
}));

const response = {
  currency: 'LKR',
  snapshotTimestamp: '2026-10-19T00:00:00.000Z',
  reorderThresholdUsed: 5,
  summary: {
    totalStockOnHand: 120,
    totalRetailValuation: 325000,
    totalUniqueProducts: 14,
    lowStockCount: 3,
    reorderTriggeredCount: 1,
    okStockCount: 10,
  },
  breakdowns: { byBranch: [], byCategory: [] },
};

function show() {
  return render(
    <MemoryRouter>
      <InventoryReportPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { role: 'BRANCH_MANAGER', branchId: '507f1f77bcf86cd799439011' };
  state.unauthorized = false;
  getInventoryReport.mockResolvedValue(response);
});

describe('inventory reporting dashboard', () => {
  it('displays authoritative snapshot values and a reporting timestamp', async () => {
    show();
    expect(await screen.findByText('Total stock on hand')).toBeInTheDocument();

    expect(
      screen.queryByText('Retail inventory valuation'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Total stock on hand')).toBeInTheDocument();
    expect(screen.queryByText('Unique products')).not.toBeInTheDocument();
    expect(screen.queryByText('Items with OK status')).not.toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText(/As of .*Asia\/Colombo/)).toBeInTheDocument();
    expect(screen.getByText('Reporting threshold: 5')).toBeInTheDocument();
    expect(getInventoryReport).toHaveBeenCalledWith({ groupBy: 'branch' });
  });

  it('does not expose a cross-branch selector to Branch Managers', async () => {
    show();
    expect(await screen.findByText('Total stock on hand')).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Branch' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Scope: Your assigned branch')).toBeInTheDocument();
    expect(getInventoryReport).toHaveBeenCalledWith(
      expect.not.objectContaining({ branchId: expect.anything() }),
    );
  });

  it('allows System Admin to apply branch, category, stock status and grouping filters', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };
    show();
    await screen.findByText('Total stock on hand');
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Branch' }),
      '507f191e810c19729de860ea',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Group results by' }),
      'category',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Category' }),
      'Frames',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Stock status' }),
      'LOW_STOCK',
    );
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(getInventoryReport).toHaveBeenLastCalledWith({
        branchId: '507f191e810c19729de860ea',
        groupBy: 'category',
        category: 'Frames',
        reorderStatus: 'LOW_STOCK',
      }),
    );
  });

  it('provides manager filters without adding client-authorized branchId', async () => {
    show();
    await screen.findByText('Total stock on hand');
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Stock status' }),
      'REORDER_TRIGGERED',
    );
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(getInventoryReport).toHaveBeenLastCalledWith({
        groupBy: 'branch',
        reorderStatus: 'REORDER_TRIGGERED',
      }),
    );
  });

  it('shows a truthful empty snapshot state without inventing history', async () => {
    getInventoryReport.mockResolvedValueOnce({
      ...response,
      summary: {
        ...response.summary,
        totalUniqueProducts: 0,
        totalStockOnHand: 0,
      },
    });
    show();
    expect(
      await screen.findByText('No inventory items match the selected filters.'),
    ).toBeInTheDocument();
  });

  it('does not show financial data when backend denies access', async () => {
    getInventoryReport.mockRejectedValueOnce(
      Object.assign(new Error('private figures'), { status: 403 }),
    );
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(
      screen.queryByText('Retail inventory valuation'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('private figures')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('uses shared logout and replace navigation on expired reporting requests', async () => {
    getInventoryReport.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    show();
    await waitFor(() => expect(state.logout).toHaveBeenCalled());
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(
      screen.queryByText('Retail inventory valuation'),
    ).not.toBeInTheDocument();
  });

  it('logs out on shared Branch lookup session expiry', async () => {
    state.unauthorized = true;
    show();
    await waitFor(() => expect(state.logout).toHaveBeenCalled());
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('can retry a network failure without displaying backend details', async () => {
    getInventoryReport
      .mockRejectedValueOnce(new Error('secret'))
      .mockResolvedValueOnce(response);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load',
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Total stock on hand')).toBeInTheDocument();
    expect(getInventoryReport).toHaveBeenCalledTimes(2);
  });
  it('shows retail inventory valuation to System Admin', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };

    show();

    expect(
      await screen.findByText('Retail inventory valuation'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('325,000.00', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unique products')).not.toBeInTheDocument();
    expect(screen.queryByText('Items with OK status')).not.toBeInTheDocument();
  });
});
