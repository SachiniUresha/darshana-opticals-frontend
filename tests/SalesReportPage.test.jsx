import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SalesReportPage from '../src/pages/SalesReportPage';
import { getSalesReport } from '../src/services/reportService';

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
  getSalesReport: vi.fn(),
  getSalesOrders: vi.fn().mockResolvedValue({
    orders: [],
    pagination: { page: 1, limit: 20, totalRecords: 0, totalPages: 0 },
  }),
}));

const response = {
  currency: 'LKR',
  timezone: 'Asia/Colombo',
  dateRange: {
    preset: 'last_30_days',
    startDate: '2026-09-19',
    endDate: '2026-10-19',
  },
  summary: {
    grossRevenue: 10000,
    refundDeductions: 500,
    netRevenue: 9500,
    totalOrders: 3,
    averageOrderValue: 3333.33,
    itemsSold: 7,
    cancelledOrdersCount: 1,
    cancelledOrdersValue: 800,
  },
  breakdowns: {
    byTime: [],
    byBranch: [],
    byCategory: [],
    byPaymentMethod: [],
  },
};

function show() {
  return render(
    <MemoryRouter>
      <SalesReportPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { role: 'BRANCH_MANAGER', branchId: '507f1f77bcf86cd799439011' };
  state.unauthorized = false;
  getSalesReport.mockResolvedValue(response);
});

describe('sales reporting dashboard', () => {
  it('renders authoritative backend KPIs and the approved date period', async () => {
    show();
    expect(await screen.findByText(/LKR\s*9,500\.00/)).toBeInTheDocument();
    expect(screen.getByText('Gross revenue')).toBeInTheDocument();
    expect(
      screen.getByText('2026-09-19 to 2026-10-19', { exact: false }),
    ).toBeInTheDocument();
    expect(getSalesReport).toHaveBeenCalledWith({
      preset: 'last_30_days',
      groupBy: 'day',
    });
  });

  it('restricts Branch Managers to backend-enforced assigned scope', async () => {
    show();
    expect(await screen.findByText('Gross revenue')).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Branch' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Scope: Your assigned branch')).toBeInTheDocument();
    expect(getSalesReport).toHaveBeenCalledWith(
      expect.not.objectContaining({ branchId: expect.anything() }),
    );
  });

  it('lets System Admin select an approved branch then apply filters', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };
    show();
    await screen.findByText('Gross revenue');
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Branch' }),
      '507f191e810c19729de860ea',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Group results by' }),
      'branch',
    );
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(getSalesReport).toHaveBeenLastCalledWith({
        preset: 'last_30_days',
        groupBy: 'branch',
        branchId: '507f191e810c19729de860ea',
      }),
    );
  });

  it('passes custom dates as raw ISO dates without browser timezone shifts', async () => {
    show();
    await screen.findByText('Gross revenue');
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Date range' }),
      'custom',
    );
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-10-01' },
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-10-15' },
    });
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(getSalesReport).toHaveBeenLastCalledWith({
        preset: 'custom',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
        groupBy: 'day',
      }),
    );
  });

  it('rejects incomplete custom date ranges without another request', async () => {
    show();
    await screen.findByText('Gross revenue');
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole('combobox', { name: 'Date range' }),
        'custom',
      );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select both start and end dates',
    );
    expect(getSalesReport).toHaveBeenCalledTimes(1);
  });

  it('shows a truthful zero-sales state instead of inventing records', async () => {
    getSalesReport.mockResolvedValueOnce({
      ...response,
      summary: { ...response.summary, totalOrders: 0, netRevenue: 0 },
    });
    show();
    expect(
      await screen.findByText('No qualifying sales for the selected filters.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/LKR\s*0\.00/)).toBeInTheDocument();
  });

  it('clears restricted metrics and shows safe feedback after a 403 response', async () => {
    getSalesReport.mockRejectedValueOnce(
      Object.assign(new Error('private info'), { status: 403 }),
    );
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'do not have permission',
    );
    expect(screen.queryByText('Net revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('private info')).not.toBeInTheDocument();
  });

  it('uses shared logout and replace navigation when a report request receives 401', async () => {
    getSalesReport.mockRejectedValueOnce(
      Object.assign(new Error('expired'), { status: 401 }),
    );
    show();
    await waitFor(() => expect(state.logout).toHaveBeenCalledTimes(1));
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(screen.queryByText('Net revenue')).not.toBeInTheDocument();
  });

  it('logs out when shared branch lookup reports an expired session', async () => {
    state.unauthorized = true;
    show();
    await waitFor(() => expect(state.logout).toHaveBeenCalled());
    expect(state.navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('retries a failed request using approved filters', async () => {
    getSalesReport
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Gross revenue')).toBeInTheDocument();
    expect(getSalesReport).toHaveBeenCalledTimes(2);
  });
});
