import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StaffLoyaltyPage from '../src/pages/StaffLoyaltyPage';
import useAuth from '../src/hooks/useAuth';
import { getManagementLoyalty } from '../src/services/loyaltyService';

vi.mock('../src/hooks/useAuth');

vi.mock('../src/services/loyaltyService', () => ({
  LOYALTY_EVENT_TYPES: [
    'EARN_PURCHASE',
    'REFUND_REVERSAL',
    'REDEMPTION_DEDUCTION',
  ],
  getManagementLoyalty: vi.fn(),
}));

const CUSTOMER_ID = '68f200000000000000000001';
const ORDER_ID = '68f200000000000000000002';
const PAYMENT_ID = '68f200000000000000000003';

const response = {
  transactions: [
    {
      id: '68f200000000000000000004',
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      type: 'EARN_PURCHASE',
      pointsDelta: '120.00',
      balanceAfter: '320.00',
      createdAt: '2026-10-17T10:00:00.000Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 25,
    total: 1,
    totalPages: 1,
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/loyalty']}>
      <Routes>
        <Route path="/staff/loyalty" element={<StaffLoyaltyPage />} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function findTransactionTable() {
  return screen.findByRole('table', {
    name: /customer loyalty transaction monitoring/i,
  });
}

describe('StaffLoyaltyPage', () => {
  let logout;

  beforeEach(() => {
    vi.clearAllMocks();

    logout = vi.fn();

    useAuth.mockReturnValue({
      logout,
    });

    getManagementLoyalty.mockResolvedValue(response);
  });

  it('shows loading while loyalty monitoring data is requested', async () => {
    let resolveRequest;

    getManagementLoyalty.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading loyalty activity/i,
    );

    await act(async () => {
      resolveRequest(response);
    });
  });

  it('renders backend-authoritative loyalty monitoring data', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Loyalty Monitoring',
      }),
    ).toBeInTheDocument();

    const table = await findTransactionTable();

    expect(within(table).getByText('Points Earned')).toBeInTheDocument();
    expect(within(table).getByText('120.00')).toBeInTheDocument();
    expect(within(table).getByText('320.00')).toBeInTheDocument();
    expect(within(table).getByText(CUSTOMER_ID)).toBeInTheDocument();
    expect(within(table).getByText(ORDER_ID)).toBeInTheDocument();
    expect(within(table).getByText(PAYMENT_ID)).toBeInTheDocument();
  });

  it('loads the documented default page from the backend', async () => {
    renderPage();

    await findTransactionTable();

    expect(getManagementLoyalty).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      customerId: '',
      orderId: '',
      paymentId: '',
      eventType: '',
      sortOrder: 'desc',
    });
  });

  it('applies documented backend filters', async () => {
    const user = userEvent.setup();

    renderPage();

    await findTransactionTable();

    await user.type(screen.getByLabelText('Customer ID'), CUSTOMER_ID);
    await user.type(screen.getByLabelText('Order ID'), ORDER_ID);
    await user.type(screen.getByLabelText('Payment ID'), PAYMENT_ID);

    await user.selectOptions(
      screen.getByLabelText('Event type'),
      'REFUND_REVERSAL',
    );

    await user.selectOptions(screen.getByLabelText('Sort order'), 'asc');

    await user.click(
      screen.getByRole('button', {
        name: 'Apply Filters',
      }),
    );

    expect(getManagementLoyalty).toHaveBeenLastCalledWith({
      page: 1,
      limit: 25,
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      eventType: 'REFUND_REVERSAL',
      sortOrder: 'asc',
    });
  });

  it('shows a safe message for invalid identifiers', async () => {
    const user = userEvent.setup();

    renderPage();

    await findTransactionTable();

    getManagementLoyalty.mockRejectedValueOnce(
      new Error('customerId must be a valid identifier.'),
    );

    await user.type(screen.getByLabelText('Customer ID'), 'invalid-id');

    await user.click(
      screen.getByRole('button', {
        name: 'Apply Filters',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /check the loyalty filters/i,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders a valid empty monitoring state', async () => {
    getManagementLoyalty.mockResolvedValue({
      transactions: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
      },
    });

    renderPage();

    expect(
      await screen.findByText('No loyalty transactions found.'),
    ).toBeInTheDocument();
  });

  it('does not expose loyalty mutation controls', async () => {
    renderPage();

    await findTransactionTable();

    expect(
      screen.queryByRole('button', {
        name: /add points|deduct points|set balance|edit loyalty|adjust/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('logs out and redirects when the session expires', async () => {
    getManagementLoyalty.mockRejectedValue({
      status: 401,
    });

    renderPage();

    expect(
      await screen.findByRole('heading', {
        name: 'Login destination',
      }),
    ).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows a safe authorization error', async () => {
    getManagementLoyalty.mockRejectedValue({
      status: 403,
      message: 'Internal authorization details',
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission/i,
    );

    expect(
      screen.queryByText(/internal authorization details/i),
    ).not.toBeInTheDocument();
  });

  it('retries after a network failure', async () => {
    const user = userEvent.setup();

    getManagementLoyalty
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(response);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /cannot connect/i,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Try Again',
      }),
    );

    const table = await findTransactionTable();

    expect(within(table).getByText('Points Earned')).toBeInTheDocument();
    expect(getManagementLoyalty).toHaveBeenCalledTimes(2);
  });

  it('requests the next backend page', async () => {
    const user = userEvent.setup();

    getManagementLoyalty.mockResolvedValue({
      ...response,
      pagination: {
        page: 1,
        limit: 25,
        total: 30,
        totalPages: 2,
      },
    });

    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'Next',
      }),
    );

    expect(getManagementLoyalty).toHaveBeenLastCalledWith({
      page: 2,
      limit: 25,
      customerId: '',
      orderId: '',
      paymentId: '',
      eventType: '',
      sortOrder: 'desc',
    });
  });
});
