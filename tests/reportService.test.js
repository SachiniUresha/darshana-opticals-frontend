import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import {
  getSalesReport,
  getSalesOrders,
  getInventoryReport,
  getInventoryItems,
} from '../src/services/reportService';

vi.mock('../src/services/apiClient', () => ({
  default: { get: vi.fn() },
}));

const sales = {
  currency: 'LKR',
  timezone: 'Asia/Colombo',
  dateRange: {
    preset: 'today',
    startDate: '2026-10-19',
    endDate: '2026-10-19',
  },
  summary: {
    grossRevenue: 2000,
    refundDeductions: 100,
    netRevenue: 1900,
    totalOrders: 2,
    itemsSold: 3,
    averageOrderValue: 1000,
    cancelledOrdersCount: 0,
    cancelledOrdersValue: 0,
  },
  breakdowns: { byTime: [], byBranch: [], byCategory: [], byPaymentMethod: [] },
};
const inventory = {
  currency: 'LKR',
  snapshotTimestamp: '2026-10-19T00:00:00.000Z',
  summary: {
    totalStockOnHand: 20,
    totalRetailValuation: 3000,
    totalUniqueProducts: 2,
    lowStockCount: 1,
    reorderTriggeredCount: 0,
    okStockCount: 1,
  },
  breakdowns: { byBranch: [], byCategory: [] },
};
const pagination = { page: 1, limit: 20, totalRecords: 0, totalPages: 0 };

beforeEach(() => vi.clearAllMocks());

describe('authoritative reporting API integration', () => {
  it('loads sales metrics without calculating new financial totals', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: sales });
    await expect(getSalesReport()).resolves.toEqual(sales);
    expect(apiClient.get).toHaveBeenCalledWith('/reports/sales');
  });

  it('uses only documented sales summary filters and escapes the query', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: sales });
    await getSalesReport({
      preset: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      branchId: 'abcd123',
      groupBy: 'day',
      fakeRole: 'SYSTEM_ADMIN',
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/reports/sales?preset=custom&startDate=2026-01-01&endDate=2026-01-31&branchId=abcd123&groupBy=day',
    );
  });

  it('uses backend-owned summary figures unchanged, including zeroes', async () => {
    const zeroSummary = {
      ...sales,
      summary: { ...sales.summary, netRevenue: 0 },
    };
    apiClient.get.mockResolvedValueOnce({ success: true, data: zeroSummary });
    expect((await getSalesReport()).summary.netRevenue).toBe(0);
  });

  it('loads approved inventory snapshot filters without browser low-stock calculations', async () => {
    apiClient.get.mockResolvedValueOnce({ success: true, data: inventory });
    await expect(
      getInventoryReport({
        branchId: 'ALL',
        reorderStatus: 'LOW_STOCK',
        groupBy: 'category',
      }),
    ).resolves.toEqual(inventory);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/reports/inventory?branchId=ALL&reorderStatus=LOW_STOCK&groupBy=category',
    );
  });

  it('loads masked sales orders and backend pagination metadata', async () => {
    const data = {
      orders: [{ orderId: 'o1', customer: { name: 'K***' } }],
      pagination,
    };
    apiClient.get.mockResolvedValueOnce({ success: true, data });
    await expect(
      getSalesOrders({
        page: 2,
        limit: 20,
        sortBy: 'paidAt',
        sortOrder: 'desc',
        illegal: true,
      }),
    ).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/reports/sales/orders?page=2&limit=20&sortBy=paidAt&sortOrder=desc',
    );
  });

  it('loads inventory detail and server-side pagination', async () => {
    const data = { items: [], pagination };
    apiClient.get.mockResolvedValueOnce({ success: true, data });
    await expect(
      getInventoryItems({
        category: 'Frames & Lenses',
        page: 1,
        sortBy: 'quantity',
      }),
    ).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/reports/inventory/items?category=Frames+%26+Lenses&page=1&sortBy=quantity',
    );
  });

  it('rejects missing reporting summaries instead of inventing numbers', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: { summary: {}, breakdowns: {} },
    });
    await expect(getSalesReport()).rejects.toThrow(
      'Invalid reporting summary response',
    );
  });

  it('rejects malformed paginated data instead of fabricating records', async () => {
    apiClient.get.mockResolvedValueOnce({
      success: true,
      data: { orders: [], pagination: {} },
    });
    await expect(getSalesOrders()).rejects.toThrow(
      'Invalid reporting detail response',
    );
  });

  it('propagates backend 401 and 403 errors to the UI for shared auth handling', async () => {
    const expired = Object.assign(new Error('Expired'), { status: 401 });
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
    apiClient.get
      .mockRejectedValueOnce(expired)
      .mockRejectedValueOnce(forbidden);
    await expect(getSalesReport()).rejects.toBe(expired);
    await expect(getInventoryReport()).rejects.toBe(forbidden);
  });
});
