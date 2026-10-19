import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportDetails from '../src/components/reports/ReportDetails';
import {
  getSalesOrders,
  getInventoryItems,
} from '../src/services/reportService';
import { downloadReportExport } from '../src/services/reportExportService';

const state = vi.hoisted(() => ({ logout: vi.fn(), navigate: vi.fn() }));
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ logout: state.logout }),
}));
vi.mock('react-router-dom', async (original) => ({
  ...(await original()),
  useNavigate: () => state.navigate,
}));
vi.mock('../src/services/reportService', () => ({
  getSalesOrders: vi.fn(),
  getInventoryItems: vi.fn(),
}));
vi.mock('../src/services/reportExportService', () => ({
  downloadReportExport: vi.fn(),
}));

const salesApplied = { preset: 'last_30_days', groupBy: 'day', branchId: '' };
const stockApplied = {
  branchId: '',
  category: 'Frames',
  reorderStatus: 'LOW_STOCK',
  groupBy: 'branch',
};
const salesRow = {
  orderId: 'order-1',
  paymentId: 'payment-1',
  paidAt: '2026-10-18T05:00:00.000Z',
  paidAmount: 4500,
  branchName: 'Kandy',
  orderStatus: 'COMPLETED',
  itemCount: 2,
  customer: {
    name: 'K*** P***',
    email: 'k***@example.com',
    prescription: 'SECRET',
  },
};
const stockRow = {
  id: 'item-1',
  name: 'Frame A',
  category: 'Frames',
  quantity: 2,
  branchName: 'Kandy',
  reorderStatus: 'LOW_STOCK',
  unitPrice: 1200,
  retailValuation: 2400,
};
const pages = { page: 1, limit: 20, totalRecords: 1, totalPages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  getSalesOrders.mockResolvedValue({ orders: [salesRow], pagination: pages });
  getInventoryItems.mockResolvedValue({ items: [stockRow], pagination: pages });
  downloadReportExport.mockResolvedValue(undefined);
});

describe('backend detail reporting', () => {
  it('renders only approved masked sales DTO fields', async () => {
    render(
      <ReportDetails
        kind="sales"
        applied={salesApplied}
        admin={false}
        scopeId="BRANCH_MANAGER:b1"
      />,
    );
    expect(await screen.findByText('K*** P***')).toBeInTheDocument();
    expect(screen.getByText('order-1')).toBeInTheDocument();
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
    expect(screen.queryByText('k***@example.com')).not.toBeInTheDocument();
    expect(getSalesOrders).toHaveBeenCalledWith({
      preset: 'last_30_days',
      page: 1,
      limit: 20,
      sortBy: 'paidAt',
      sortOrder: 'desc',
    });
  });

  it('paginates and sorts only through the backend', async () => {
    getSalesOrders.mockImplementation(async ({ page = 1 }) => ({
      orders: [salesRow],
      pagination: { ...pages, page, totalRecords: 23, totalPages: 2 },
    }));
    render(
      <ReportDetails
        kind="sales"
        applied={salesApplied}
        admin={false}
        scopeId="m"
      />,
    );
    await screen.findByText('order-1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(getSalesOrders).toHaveBeenLastCalledWith({
        preset: 'last_30_days',
        page: 2,
        limit: 20,
        sortBy: 'paidAt',
        sortOrder: 'desc',
      }),
    );
    await screen.findByText('Page 2 of 2 (23 records)');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort by' }),
      'totalAmount',
    );
    await waitFor(() =>
      expect(getSalesOrders).toHaveBeenLastCalledWith({
        preset: 'last_30_days',
        page: 1,
        limit: 20,
        sortBy: 'totalAmount',
        sortOrder: 'desc',
      }),
    );
  });

  it('supports approved order-status filter without modifying exports', async () => {
    render(
      <ReportDetails
        kind="sales"
        applied={salesApplied}
        admin={false}
        scopeId="m"
      />,
    );
    await screen.findByText('order-1');
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Order status' }),
        'COMPLETED',
      );
    await waitFor(() =>
      expect(getSalesOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderStatus: 'COMPLETED' }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled(),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() =>
      expect(downloadReportExport).toHaveBeenCalledWith(
        'sales',
        {
          preset: 'last_30_days',
        },
        'csv',
      ),
    );
  });

  it('shows authoritative inventory valuation only to System Admin', async () => {
    render(
      <ReportDetails
        kind="inventory"
        applied={stockApplied}
        admin
        scopeId="admin"
      />,
    );
    expect(await screen.findByText('Frame A')).toBeInTheDocument();
    expect(screen.getByText('LOW_STOCK')).toBeInTheDocument();
    expect(screen.getByText(/2,400\.00/)).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Valuation' }),
    ).toBeInTheDocument();
    expect(getInventoryItems).toHaveBeenCalledWith({
      category: 'Frames',
      reorderStatus: 'LOW_STOCK',
      page: 1,
      limit: 20,
      sortBy: 'quantity',
      sortOrder: 'desc',
    });
  });

  it('hides the valuation column from Branch Managers while retaining operational stock fields', async () => {
    // The backend intentionally omits item-level retailValuation for Branch Managers.
    getInventoryItems.mockResolvedValueOnce({
      items: [{ ...stockRow, retailValuation: undefined }],
      pagination: pages,
    });
    render(
      <ReportDetails
        kind="inventory"
        applied={stockApplied}
        admin={false}
        scopeId="BRANCH_MANAGER:b1"
      />,
    );
    expect(await screen.findByText('Frame A')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Unit price' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Valuation' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/1,200\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/2,400\.00/)).not.toBeInTheDocument();
  });

  it('passes admin branch filter through to backend listings and export', async () => {
    render(
      <ReportDetails
        kind="inventory"
        applied={{ ...stockApplied, branchId: 'b2' }}
        admin
        scopeId="admin:b2"
      />,
    );
    await screen.findByText('Frame A');
    expect(getInventoryItems).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'b2' }),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Export Excel' }));
    await waitFor(() =>
      expect(downloadReportExport).toHaveBeenCalledWith(
        'inventory',
        {
          category: 'Frames',
          reorderStatus: 'LOW_STOCK',
          branchId: 'b2',
        },
        'xlsx',
      ),
    );
  });

  it('displays truthful empty state without any fabricated rows', async () => {
    getInventoryItems.mockResolvedValueOnce({
      items: [],
      pagination: { ...pages, totalRecords: 0, totalPages: 0 },
    });
    render(
      <ReportDetails
        kind="inventory"
        applied={stockApplied}
        admin={false}
        scopeId="m"
      />,
    );
    expect(
      await screen.findByText('No records match the selected report filters.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Frame A')).not.toBeInTheDocument();
  });

  it('clears records on permission denial and does not expose backend messages', async () => {
    getSalesOrders.mockRejectedValueOnce(
      Object.assign(new Error('SECRET'), { status: 403 }),
    );
    render(
      <ReportDetails
        kind="sales"
        applied={salesApplied}
        admin={false}
        scopeId="m"
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
    expect(screen.queryByText('order-1')).not.toBeInTheDocument();
  });

  it('logs out and redirects after backend 401 from details', async () => {
    getSalesOrders.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    render(
      <ReportDetails
        kind="sales"
        applied={salesApplied}
        admin={false}
        scopeId="m"
      />,
    );
    await waitFor(() => expect(state.logout).toHaveBeenCalledTimes(1));
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('logs out and redirects after backend 401 from export', async () => {
    render(
      <ReportDetails
        kind="sales"
        applied={salesApplied}
        admin={false}
        scopeId="m"
      />,
    );
    await screen.findByText('order-1');
    downloadReportExport.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(state.logout).toHaveBeenCalled());
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
