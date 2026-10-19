import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authStorage from '../src/services/auth/authStorage';
import { downloadReportExport } from '../src/services/reportExportService';

vi.mock('../src/config/env', () => ({
  env: { apiBaseUrl: 'http://localhost:5000/api' },
}));
vi.mock('../src/services/auth/authStorage', () => ({
  default: { getToken: vi.fn() },
}));

let originalCreate;
let originalRevoke;
let clickSpy;
beforeEach(() => {
  vi.clearAllMocks();
  authStorage.getToken.mockReturnValue('valid-token');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi
        .fn()
        .mockResolvedValue(new Blob(['report'], { type: 'text/csv' })),
    }),
  );
  originalCreate = URL.createObjectURL;
  originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:report');
  URL.revokeObjectURL = vi.fn();
  clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

describe('binary report export service', () => {
  it('downloads CSV with shared bearer authentication and approved sales filters only', async () => {
    await downloadReportExport(
      'sales',
      {
        preset: 'custom',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        role: 'SYSTEM_ADMIN',
        orderStatus: 'COMPLETED',
        sortBy: 'paidAt',
      },
      'csv',
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/reports/sales/export?preset=custom&startDate=2026-01-01&endDate=2026-01-31&format=csv',
      { method: 'GET', headers: { Authorization: 'Bearer valid-token' } },
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });

  it('downloads approved inventory snapshot filters and uses xlsx endpoint format', async () => {
    await downloadReportExport(
      'inventory',
      {
        category: 'Men & Women',
        reorderStatus: 'LOW_STOCK',
        branchId: 'b1',
        dateRange: 'yesterday',
      },
      'xlsx',
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/reports/inventory/export?branchId=b1&category=Men+%26+Women&reorderStatus=LOW_STOCK&format=xlsx',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('fails closed when there is no authenticated token', async () => {
    authStorage.getToken.mockReturnValue(null);
    await expect(downloadReportExport('sales')).rejects.toMatchObject({
      status: 401,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not claim download success on server access denial', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(downloadReportExport('sales')).rejects.toMatchObject({
      status: 403,
    });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('rejects unsupported formats without a request', async () => {
    await expect(downloadReportExport('sales', {}, 'pdf')).rejects.toThrow(
      'Unsupported',
    );
    await expect(downloadReportExport('other', {}, 'csv')).rejects.toThrow(
      'Unsupported',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects empty binary responses instead of saving an empty report', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: async () => new Blob([]),
    });
    await expect(downloadReportExport('inventory')).rejects.toThrow('empty');
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
