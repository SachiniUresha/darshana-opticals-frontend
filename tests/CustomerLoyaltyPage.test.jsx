import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CustomerLoyaltyPage from '../src/pages/CustomerLoyaltyPage';
import useAuth from '../src/hooks/useAuth';
import { getOwnLoyalty } from '../src/services/loyaltyService';

vi.mock('../src/hooks/useAuth');

vi.mock('../src/services/loyaltyService', () => ({
  getOwnLoyalty: vi.fn(),
}));

const loyaltyResponse = {
  balance: '285.00',
  transactions: [
    {
      id: '68f200000000000000000001',
      type: 'EARN_PURCHASE',
      pointsDelta: '285.00',
      balanceAfter: '285.00',
      orderId: '68f200000000000000000002',
      createdAt: '2026-10-17T10:00:00.000Z',
    },
    {
      id: '68f200000000000000000003',
      type: 'REFUND_REVERSAL',
      pointsDelta: '-50.00',
      balanceAfter: '235.00',
      orderId: '68f200000000000000000004',
      createdAt: '2026-10-16T10:00:00.000Z',
    },
  ],
  pagination: {
    page: 1,
    limit: 25,
    total: 2,
    totalPages: 1,
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile/loyalty']}>
      <Routes>
        <Route path="/profile/loyalty" element={<CustomerLoyaltyPage />} />
        <Route path="/profile" element={<h1>Profile destination</h1>} />
        <Route path="/login" element={<h1>Login destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CustomerLoyaltyPage', () => {
  let logout;

  beforeEach(() => {
    vi.clearAllMocks();

    logout = vi.fn();

    useAuth.mockReturnValue({
      logout,
    });

    getOwnLoyalty.mockResolvedValue(loyaltyResponse);
  });

  it('shows a loading state while loyalty information is requested', async () => {
    let resolveRequest;

    getOwnLoyalty.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading your loyalty information/i,
    );

    await act(async () => {
      resolveRequest(loyaltyResponse);
    });
  });

  it('renders the backend-authoritative loyalty balance and history', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'My Loyalty' }),
    ).toBeInTheDocument();

    expect(await screen.findByText('285.00')).toBeInTheDocument();
    expect(screen.getByText('Points earned')).toBeInTheDocument();
    expect(screen.getByText('Points reversed')).toBeInTheDocument();

    expect(screen.getAllByText('285.00 points')).toHaveLength(2);
    expect(screen.getByText('-50.00 points')).toBeInTheDocument();
    expect(screen.getByText('235.00 points')).toBeInTheDocument();

    expect(getOwnLoyalty).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
    });
  });

  it('renders a valid zero and empty loyalty state', async () => {
    getOwnLoyalty.mockResolvedValue({
      balance: '0.00',
      transactions: [],
      pagination: {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
      },
    });

    renderPage();

    expect(await screen.findByText('0.00')).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: /no loyalty activity yet/i }),
    ).toBeInTheDocument();
  });

  it('does not expose loyalty mutation or redemption controls', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'My Loyalty' });

    expect(
      screen.queryByRole('button', {
        name: /add points|deduct points|set balance|edit loyalty|redeem/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('logs out and redirects when the session expires', async () => {
    getOwnLoyalty.mockRejectedValue({
      status: 401,
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Login destination' }),
    ).toBeInTheDocument();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('shows a safe authorization error', async () => {
    getOwnLoyalty.mockRejectedValue({
      status: 403,
      message: 'Sensitive backend message',
    });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission/i,
    );

    expect(
      screen.queryByText(/Sensitive backend message/i),
    ).not.toBeInTheDocument();
  });

  it('can retry after a network failure', async () => {
    const user = userEvent.setup();

    getOwnLoyalty
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce({
        balance: '0.00',
        transactions: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
        },
      });

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unable to load your loyalty information/i,
    );

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('0.00')).toBeInTheDocument();
    expect(getOwnLoyalty).toHaveBeenCalledTimes(2);
  });

  it('requests the next backend history page without calculating locally', async () => {
    const user = userEvent.setup();

    getOwnLoyalty.mockResolvedValue({
      ...loyaltyResponse,
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
        name: /next/i,
      }),
    );

    expect(getOwnLoyalty).toHaveBeenLastCalledWith({
      page: 2,
      limit: 25,
    });
  });

  it('allows the Customer to return to the existing Profile area', async () => {
    const user = userEvent.setup();

    renderPage();

    await user.click(
      await screen.findByRole('link', {
        name: /back to my profile/i,
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Profile destination' }),
    ).toBeInTheDocument();
  });
});
