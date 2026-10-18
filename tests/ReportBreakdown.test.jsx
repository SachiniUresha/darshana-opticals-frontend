import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ReportBreakdown from '../src/components/reports/ReportBreakdown';

describe('authoritative report breakdown presentation', () => {
  it('shows sales payment periods and exact server gross revenue without local totals', () => {
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
      name: 'Gross revenue by payment period table',
    });
    expect(
      within(chart).getByRole('columnheader', { name: 'Period' }),
    ).toBeInTheDocument();
    expect(
      within(chart).getByRole('rowheader', { name: '2026-W41' }),
    ).toBeInTheDocument();
    expect(within(chart).getByText(/1,250\.00/)).toBeInTheDocument();
    expect(within(chart).getByText(/500\.00/)).toBeInTheDocument();
    expect(within(chart).queryByText(/1,750\.00/)).not.toBeInTheDocument();
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
});
