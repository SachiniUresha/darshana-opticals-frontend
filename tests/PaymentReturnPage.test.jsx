import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import PaymentReturnPage from '../src/pages/PaymentReturnPage';

const orderId = '507f1f77bcf86cd799439021';
const PAYMENT_ORDER_STORAGE_KEY = 'osms.payment.orderId';

function PaymentResultDestination() {
  const location = useLocation();
  const source = new URLSearchParams(location.search).get('source');

  return (
    <div>
      <span>Payment result destination</span>
      <span data-testid="result-source">{source}</span>
    </div>
  );
}

function renderReturnPage(path) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/payments/return" element={<PaymentReturnPage />} />
          <Route path="/payments/cancel" element={<PaymentReturnPage />} />

          <Route
            path="/payments/result/:orderId"
            element={<PaymentResultDestination />}
          />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('PaymentReturnPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('recovers the safe Order ID after a PayHere return under React StrictMode', async () => {
    sessionStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, orderId);

    renderReturnPage('/payments/return');

    expect(
      await screen.findByText('Payment result destination'),
    ).toBeInTheDocument();

    expect(screen.getByTestId('result-source')).toHaveTextContent('return');

    expect(
      screen.queryByText('Payment status unavailable'),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(sessionStorage.getItem(PAYMENT_ORDER_STORAGE_KEY)).toBeNull();
    });
  });

  it('recovers the safe Order ID after a PayHere cancellation under React StrictMode', async () => {
    sessionStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, orderId);

    renderReturnPage('/payments/cancel');

    expect(
      await screen.findByText('Payment result destination'),
    ).toBeInTheDocument();

    expect(screen.getByTestId('result-source')).toHaveTextContent('cancel');

    await waitFor(() => {
      expect(sessionStorage.getItem(PAYMENT_ORDER_STORAGE_KEY)).toBeNull();
    });
  });

  it('does not trust an invalid stored Order ID', () => {
    sessionStorage.setItem(
      PAYMENT_ORDER_STORAGE_KEY,
      '<script>invalid-order</script>',
    );

    renderReturnPage('/payments/return');

    expect(
      screen.getByRole('heading', {
        name: 'Payment status unavailable',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: 'Go to My Orders' }),
    ).toHaveAttribute('href', '/orders');
  });

  it('provides safe recovery when no stored Order ID exists', () => {
    renderReturnPage('/payments/return');

    expect(
      screen.getByRole('heading', {
        name: 'Payment status unavailable',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/could not identify the order/i),
    ).toBeInTheDocument();
  });
});
