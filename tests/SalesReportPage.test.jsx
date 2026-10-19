import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
  it('renders backend net revenue progression alongside order volume', async () => {
    getSalesReport.mockResolvedValueOnce({
      ...response,
      breakdowns: {
        ...response.breakdowns,
        byTime: [
          {
            period: '2026-10-18',
            grossRevenue: 1300,
            netRevenue: 1100,
            orderCount: 2,
          },
          {
            period: '2026-10-19',
            grossRevenue: 0,
            netRevenue: -300,
            orderCount: 0,
          },
        ],
      },
    });
    show();
    const net = await screen.findByRole('region', {
      name: 'Net revenue progression table',
    });
    expect(within(net).getByText(/1,100\.00/)).toBeInTheDocument();
    const refundRow = within(net)
      .getByRole('rowheader', { name: '2026-10-19' })
      .closest('tr');
    expect(within(refundRow).getByText(/300\.00/)).toHaveTextContent('-');
    expect(
      screen.getByRole('region', { name: 'Order volume by period table' }),
    ).toBeInTheDocument();
  });

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
  it('hides restricted financial metrics from Branch Managers', async () => {
    show();

    expect(await screen.findByText('Net revenue')).toBeInTheDocument();
    expect(screen.getByText('Gross revenue')).toBeInTheDocument();
    expect(screen.getByText('Qualifying orders')).toBeInTheDocument();

    expect(screen.queryByText('Refund deductions')).not.toBeInTheDocument();
    expect(screen.queryByText('Average order value')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelled order value')).not.toBeInTheDocument();
  });

  it('shows complete financial metrics to System Admin', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };

    show();

    expect(await screen.findByText('Refund deductions')).toBeInTheDocument();
    expect(screen.getByText('Average order value')).toBeInTheDocument();
    expect(screen.getByText('Cancelled order value')).toBeInTheDocument();
    expect(screen.getByText('Net revenue')).toBeInTheDocument();
  });
  it('immediately hides previous privileged sales data after role changes', async () => {
    const adminReport = {
      ...response,
      summary: { ...response.summary, grossRevenue: 10000 },
    };

    const managerReport = {
      ...response,
      summary: {
        ...response.summary,
        grossRevenue: 2000,
        netRevenue: 2000,
      },
    };

    let resolveManagerRequest;

    getSalesReport.mockResolvedValueOnce(adminReport).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveManagerRequest = resolve;
        }),
    );

    state.user = { role: 'SYSTEM_ADMIN' };

    const view = show();

    expect(await screen.findByText('Refund deductions')).toBeInTheDocument();
    expect(screen.getByText(/LKR\s*10,000\.00/)).toBeInTheDocument();

    state.user = {
      role: 'BRANCH_MANAGER',
      branchId: '507f1f77bcf86cd799439011',
    };

    view.rerender(
      <MemoryRouter>
        <SalesReportPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Refund deductions')).not.toBeInTheDocument();
    expect(screen.queryByText(/LKR\s*10,000\.00/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(getSalesReport).toHaveBeenCalledTimes(2);
    });

    resolveManagerRequest(managerReport);

    await waitFor(() => {
      expect(screen.getAllByText(/LKR\s*2,000\.00/)).toHaveLength(2);
    });

    expect(screen.queryByText('Refund deductions')).not.toBeInTheDocument();
    expect(screen.queryByText(/LKR\s*10,000\.00/)).not.toBeInTheDocument();
  });

  it('shows payment method breakdown to System Admin', async () => {
    state.user = { role: 'SYSTEM_ADMIN' };

    getSalesReport.mockResolvedValueOnce({
      ...response,
      breakdowns: {
        ...response.breakdowns,
        byPaymentMethod: [{ method: 'PAYHERE_CARD', count: 2, volume: 1250 }],
      },
    });

    show();

    expect(
      await screen.findByRole('region', {
        name: 'Payment method breakdown',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('rowheader', { name: 'PAYHERE_CARD' }),
    ).toBeInTheDocument();
  });

  it('does not show payment method breakdown to Branch Manager', async () => {
    getSalesReport.mockResolvedValueOnce({
      ...response,
      breakdowns: {
        ...response.breakdowns,
        byPaymentMethod: [{ method: 'PAYHERE_CARD', count: 2, volume: 1250 }],
      },
    });

    show();

    expect(await screen.findByText('Gross revenue')).toBeInTheDocument();

    expect(
      screen.queryByRole('region', {
        name: 'Payment method breakdown',
      }),
    ).not.toBeInTheDocument();

    expect(screen.queryByText('PAYHERE_CARD')).not.toBeInTheDocument();
  });
});
