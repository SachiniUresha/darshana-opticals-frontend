import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ReportBreakdown from '../src/components/reports/ReportBreakdown';

describe('authoritative report breakdown presentation', () => {
  it('displays backend net revenue, including negative refund-only periods', () => {
    const { container } = render(
      <ReportBreakdown
        kind="sales"
        groupBy="day"
        metric="netRevenue"
        breakdowns={{
          byTime: [
            {
              period: '2026-03-01',
              grossRevenue: 20000,
              netRevenue: 20000,
              orderCount: 1,
            },
            {
              period: '2026-03-02',
              grossRevenue: 0,
              netRevenue: -5000,
              orderCount: 0,
            },
          ],
        }}
      />,
    );

    const chart = screen.getByRole('region', {
      name: 'Net revenue progression table',
    });
    expect(
      within(chart).getByRole('columnheader', { name: 'Net revenue (LKR)' }),
    ).toBeInTheDocument();
    expect(within(chart).getByText(/20,000\.00/)).toBeInTheDocument();

    const refundRow = within(chart)
      .getByRole('rowheader', { name: '2026-03-02' })
      .closest('tr');
    expect(within(refundRow).getByText(/5,000\.00/)).toHaveTextContent('-');
    expect(
      refundRow.querySelector('.report-breakdown__bar--negative'),
    ).toHaveStyle({
      width: '25%',
    });
    expect(within(chart).queryByText(/15,000\.00/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('.report-breakdown__bar')).toHaveLength(
      2,
    );
  });

  it('shows backend-provided order volume trends without local calculations', () => {
    render(
      <ReportBreakdown
        kind="sales"
        groupBy="week"
        breakdowns={{
          byTime: [
            { period: '2026-W41', grossRevenue: 1250, orderCount: 2 },
            { period: '2026-W42', grossRevenue: 500, orderCount: 1 },
          ],
        }}
      />,
    );

    const chart = screen.getByRole('region', {
      name: 'Order volume by period table',
    });

    expect(
      within(chart).getByRole('columnheader', { name: 'Period' }),
    ).toBeInTheDocument();

    expect(
      within(chart).getByRole('columnheader', {
        name: 'Qualifying orders',
      }),
    ).toBeInTheDocument();

    expect(
      within(chart).getByRole('rowheader', { name: '2026-W41' }),
    ).toBeInTheDocument();

    expect(within(chart).getByText('2')).toBeInTheDocument();
    expect(within(chart).getByText('1')).toBeInTheDocument();

    // Gross revenue must not be displayed as order volume.
    expect(within(chart).queryByText(/1,250\.00/)).not.toBeInTheDocument();
    expect(within(chart).queryByText(/500\.00/)).not.toBeInTheDocument();
  });

  it('uses server item quantity for sales category breakdown, not calculated revenue', () => {
    render(
      <ReportBreakdown
        kind="sales"
        groupBy="category"
        breakdowns={{
          byCategory: [{ category: 'Frames', quantity: 7, revenue: 98765 }],
        }}
      />,
    );
    expect(
      screen.getByRole('region', { name: 'Items sold by category table' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Items sold' }),
    ).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.queryByText(/98,765/)).not.toBeInTheDocument();
  });

  it('uses authoritative inventory branch snapshots, without historical claims', () => {
    render(
      <ReportBreakdown
        kind="inventory"
        groupBy="branch"
        breakdowns={{
          byBranch: [
            {
              branchName: 'Kandy',
              totalStock: 12,
              totalRetailValuation: 15000,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Current stock by branch')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Current snapshot only. This is not historical inventory movement.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('rowheader', { name: 'Kandy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByText(/15,000/)).not.toBeInTheDocument();
  });

  it('switches inventory categories without inventing unsupported stock history', () => {
    render(
      <ReportBreakdown
        kind="inventory"
        groupBy="category"
        breakdowns={{ byCategory: [{ category: 'Sunglasses', totalStock: 3 }] }}
      />,
    );
    expect(
      screen.getByRole('rowheader', { name: 'Sunglasses' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Current stock units' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows an understandable empty state without chart bars or invented values', () => {
    render(
      <ReportBreakdown
        kind="sales"
        groupBy="day"
        breakdowns={{ byTime: [] }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'No breakdown data is available',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('ignores unsupported nonnumeric server values rather than turning them into zero', () => {
    render(
      <ReportBreakdown
        kind="inventory"
        groupBy="category"
        breakdowns={{
          byCategory: [{ category: 'Frames', totalStock: 'secret' }],
        }}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('keeps zero values readable and uses presentation-only decorative bars', () => {
    const { container } = render(
      <ReportBreakdown
        kind="inventory"
        groupBy="category"
        breakdowns={{ byCategory: [{ category: 'Empty', totalStock: 0 }] }}
      />,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(container.querySelector('.report-breakdown__track')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(container.querySelector('.report-breakdown__bar').style.width).toBe(
      '0%',
    );
  });

  it('shows backend-provided payment method breakdown without calculating totals', () => {
    render(
      <ReportBreakdown
        kind="sales"
        groupBy="paymentMethod"
        breakdowns={{
          byPaymentMethod: [
            { method: 'PAYHERE_CARD', count: 2, volume: 1250 },
            { method: 'CASH', count: 1, volume: 500 },
          ],
        }}
      />,
    );

    const chart = screen.getByRole('region', {
      name: 'Payment method breakdown table',
    });

    expect(
      within(chart).getByRole('columnheader', {
        name: 'Payment method',
      }),
    ).toBeInTheDocument();

    expect(
      within(chart).getByRole('columnheader', {
        name: 'Payment volume (LKR)',
      }),
    ).toBeInTheDocument();

    expect(
      within(chart).getByRole('rowheader', { name: 'PAYHERE_CARD' }),
    ).toBeInTheDocument();

    expect(
      within(chart).getByRole('rowheader', { name: 'CASH' }),
    ).toBeInTheDocument();

    expect(within(chart).getByText(/1,250\.00/)).toBeInTheDocument();
    expect(within(chart).getByText(/500\.00/)).toBeInTheDocument();

    // Do not calculate reporting totals in the frontend.
    expect(within(chart).queryByText(/1,750\.00/)).not.toBeInTheDocument();
  });
});
