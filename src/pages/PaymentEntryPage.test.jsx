// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentEntryPage from './PaymentEntryPage';
import { getOrder } from '../services/orderService';
import { getPaymentStatus, initiatePayment } from '../services/paymentService';

const mockAuth = vi.hoisted(() => ({
  user: { name: 'Test Customer', address: '25 Main Street, Colombo 05' },
  logout: vi.fn(),
}));
vi.mock('../hooks/useAuth', () => ({ default: () => mockAuth }));
vi.mock('../services/orderService', () => ({ getOrder: vi.fn() }));
vi.mock('../services/paymentService', () => ({
  getPaymentStatus: vi.fn(),
  initiatePayment: vi.fn(),
}));

const id = '507f1f77bcf86cd799439021';
const sampleOrder = { id, orderAmount: 32000, items: [] };

function showPage() {
  return render(
    <MemoryRouter initialEntries={[`/payments/${id}`]}>
      <Routes>
        <Route path="/payments/:orderId" element={<PaymentEntryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitPayment(city = 'Colombo') {
  fireEvent.change(screen.getByRole('textbox', { name: /Billing city/i }), {
    target: { value: city },
  });
  fireEvent.click(
    screen.getByRole('button', { name: /Review Payment|Resume Payment/i }),
  );
  await waitFor(() => expect(initiatePayment).toHaveBeenCalledTimes(1));
}

describe('PaymentEntryPage DDP-102 address selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = {
      name: 'Test Customer',
      address: '25 Main Street, Colombo 05',
    };
    getOrder.mockResolvedValue({ ...sampleOrder });
    getPaymentStatus.mockResolvedValue({
      summary: {
        paid: false,
        reconciliationRequired: false,
        activeAttempt: false,
      },
    });
    initiatePayment.mockResolvedValue({
      payment: { amount: 32000, currency: 'LKR', status: 'pending' },
      gateway: {
        checkoutUrl: 'https://sandbox.payhere.lk/pay/checkout',
        fields: {},
      },
    });
  });

  it('checks registered address by default and sends it with the required city', async () => {
    showPage();
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Use my registered address for billing and delivery',
    });
    expect(checkbox).toBeChecked();
    expect(
      screen.getByRole('textbox', { name: 'Registered Address' }),
    ).toHaveValue('25 Main Street, Colombo 05');
    await submitPayment();
    expect(initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: id,
        city: 'Colombo',
        address: '25 Main Street, Colombo 05',
      }),
    );
  });

  it('lets a customer uncheck the option and supply a custom address', async () => {
    showPage();
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Use my registered address for billing and delivery',
    });
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Address' }), {
      target: { value: '99 Test Road, Kandy' },
    });
    await submitPayment('Kandy');
    expect(initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: id,
        city: 'Kandy',
        address: '99 Test Road, Kandy',
      }),
    );
  });

  it('requires a custom address for legacy customers without a registered address', async () => {
    mockAuth.user = { name: 'Test Customer', address: ' ' };
    showPage();
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Use my registered address for billing and delivery',
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Billing city/i }), {
      target: { value: 'Galle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review Payment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No registered address is available',
    );
    expect(initiatePayment).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Address' }), {
      target: { value: '11 New Road' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review Payment' }));
    await waitFor(() =>
      expect(initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Galle', address: '11 New Road' }),
      ),
    );
  });

  it('shows confirmed saved order address instead of editable selection on retry', async () => {
    getOrder.mockResolvedValue({
      ...sampleOrder,
      orderAddress: '45 Saved Lane',
    });
    getPaymentStatus.mockResolvedValue({
      summary: {
        paid: false,
        reconciliationRequired: false,
        activeAttempt: true,
      },
    });
    showPage();
    expect(
      await screen.findByText('Order Address (confirmed)'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Order Address' })).toHaveValue(
      '45 Saved Lane',
    );
    await submitPayment('Kandy');
    expect(initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: id,
        city: 'Kandy',
        address: '45 Saved Lane',
      }),
    );
  });
});
