import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import PaymentReturnPage from '../src/pages/PaymentReturnPage';

const orderId = '507f1f77bcf86cd799439021';
const PAYMENT_ORDER_STORAGE_KEY = 'osms.payment.orderId';

function renderReturnPage(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/payments/return" element={<PaymentReturnPage />} />
        <Route path="/payments/cancel" element={<PaymentReturnPage />} />

        <Route
          path="/payments/result/:orderId"
          element={
            <div>
              Payment result destination
              <span data-testid="result-location">
                {window.location.search}
              </span>
            </div>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PaymentReturnPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('recovers the safe Order ID after a PayHere return', async () => {
    sessionStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, orderId);

    renderReturnPage('/payments/return');

    expect(
      await screen.findByText('Payment result destination'),
    ).toBeInTheDocument();

    expect(
      screen.queryByText('Payment status unavailable'),
    ).not.toBeInTheDocument();

    expect(sessionStorage.getItem(PAYMENT_ORDER_STORAGE_KEY)).toBeNull();
  });

  it('recovers the safe Order ID after a PayHere cancellation', async () => {
    sessionStorage.setItem(PAYMENT_ORDER_STORAGE_KEY, orderId);

    renderReturnPage('/payments/cancel');

    expect(
      await screen.findByText('Payment result destination'),
    ).toBeInTheDocument();

    expect(sessionStorage.getItem(PAYMENT_ORDER_STORAGE_KEY)).toBeNull();
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
