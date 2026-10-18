import './ReportBreakdown.css';

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const count = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });

/**
 * Only visualizes values provided by the authoritative reporting API.
 * Bar widths are presentation-only proportions, never reporting totals.
 */
function viewFor(kind, groupBy, breakdowns) {
  if (kind === 'sales') {
    if (groupBy === 'branch') {
      return {
        title: 'Gross revenue by branch',
        valueTitle: 'Gross revenue (LKR)',
        rows: breakdowns?.byBranch,
        key: 'branchName',
        value: 'grossRevenue',
        money: true,
      };
    }
    if (groupBy === 'category') {
      return {
        title: 'Items sold by category',
        valueTitle: 'Items sold',
        rows: breakdowns?.byCategory,
        key: 'category',
        value: 'quantity',
        money: false,
      };
    }
    return {
      title: 'Gross revenue by payment period',
      valueTitle: 'Gross revenue (LKR)',
      rows: breakdowns?.byTime,
      key: 'period',
      value: 'grossRevenue',
      money: true,
    };
  }
  return {
    title:
      groupBy === 'category'
        ? 'Current stock by category'
        : 'Current stock by branch',
    valueTitle: 'Current stock units',
    rows:
      groupBy === 'category' ? breakdowns?.byCategory : breakdowns?.byBranch,
    key: groupBy === 'category' ? 'category' : 'branchName',
    value: 'totalStock',
    money: false,
  };
}

export default function ReportBreakdown({ kind, groupBy, breakdowns }) {
  const view = viewFor(kind, groupBy, breakdowns);
  const rows = Array.isArray(view.rows)
    ? view.rows.filter(
        (entry) =>
          entry &&
          typeof entry[view.value] === 'number' &&
          Number.isFinite(entry[view.value]),
      )
    : [];
  const scale = Math.max(0, ...rows.map((entry) => entry[view.value]));

  return (
    <section className="report-breakdown" aria-label={view.title}>
      <div className="report-breakdown__heading">
        <h2>{view.title}</h2>
        <p>
          {kind === 'inventory'
            ? 'Current snapshot only. This is not historical inventory movement.'
            : 'Values use the selected reporting period and backend grouping.'}
        </p>
      </div>
      {rows.length === 0 ? (
        <p role="status">No breakdown data is available for these filters.</p>
      ) : (
        <div
          className="report-breakdown__scroll"
          role="region"
          aria-label={`${view.title} table`}
          tabIndex={0}
        >
          <table>
            <caption>Backend-provided breakdown values</caption>
            <thead>
              <tr>
                <th scope="col">
                  {kind === 'sales' && !['branch', 'category'].includes(groupBy)
                    ? 'Period'
                    : groupBy === 'category'
                      ? 'Category'
                      : 'Branch'}
                </th>
                <th scope="col">{view.valueTitle}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => {
                const rawLabel = entry[view.key];
                const label =
                  typeof rawLabel === 'string' && rawLabel.trim()
                    ? rawLabel
                    : 'Unspecified';
                const value = entry[view.value];
                const width =
                  scale > 0
                    ? Math.max(0, Math.min(100, (value / scale) * 100))
                    : 0;
                return (
                  <tr key={`${label}-${index}`}>
                    <th scope="row">{label}</th>
                    <td>
                      <span className="report-breakdown__value">
                        {view.money ? lkr.format(value) : count.format(value)}
                      </span>
                      <span
                        className="report-breakdown__track"
                        aria-hidden="true"
                      >
                        <span
                          className="report-breakdown__bar"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
