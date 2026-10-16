import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBranches } from '../src/hooks/useBranches';
import { getBranches } from '../src/services/branchService';

vi.mock('../src/services/branchService', () => ({
  getBranches: vi.fn(),
}));

describe('useBranches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in a loading state and resolves branch data', async () => {
    getBranches.mockResolvedValueOnce([
      {
        id: 'branch-1',
        address: '45 Peradeniya Road, Kandy',
        contactNumber: '+94 81 220 0000',
      },
    ]);

    const { result } = renderHook(() => useBranches());

    expect(result.current.loading).toBe(true);
    expect(result.current.branches).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.branches).toEqual([
      {
        id: 'branch-1',
        address: '45 Peradeniya Road, Kandy',
        contactNumber: '+94 81 220 0000',
      },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('supports an empty branch list and clears previous error state', async () => {
    getBranches.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useBranches());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.branches).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets a safe user-facing error when loading fails', async () => {
    const error = new Error('Server unavailable');
    error.status = 500;
    getBranches.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useBranches());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.branches).toEqual([]);
    expect(result.current.error).toBe(
      'We could not load branches. Please try again.',
    );
  });

  it('retries only when explicitly requested', async () => {
    const error = new Error('Temporary network issue');
    error.status = 0;
    error.code = 'NETWORK_ERROR';

    getBranches.mockRejectedValueOnce(error).mockResolvedValueOnce([
      {
        id: 'branch-2',
        address: '100 Galle Road, Colombo 03',
        contactNumber: '+94 11 250 0000',
      },
    ]);

    const { result } = renderHook(() => useBranches());

    await waitFor(() => {
      expect(result.current.error).toBe(
        'We could not load branches. Please try again.',
      );
    });

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getBranches).toHaveBeenCalledTimes(2);
    expect(result.current.branches).toEqual([
      {
        id: 'branch-2',
        address: '100 Galle Road, Colombo 03',
        contactNumber: '+94 11 250 0000',
      },
    ]);
  });

  it('ignores stale responses when a newer retry finishes first', async () => {
    let resolveInitial;
    let resolveRetry;
    getBranches
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInitial = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
      );

    const { result } = renderHook(() => useBranches());

    await act(async () => {
      result.current.retry();
    });

    const latestBranches = [
      { id: 'latest', address: '10 Main Street, Kandy', contactNumber: '' },
    ];
    await act(async () => {
      resolveRetry(latestBranches);
    });

    await act(async () => {
      resolveInitial([
        { id: 'stale', address: '1 Old Road, Kandy', contactNumber: '' },
      ]);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.branches).toEqual(latestBranches);
    expect(getBranches).toHaveBeenCalledTimes(2);
  });

  it('ignores a pending response and retry call after unmount', async () => {
    let resolveBranches;
    getBranches.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBranches = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useBranches());
    const retry = result.current.retry;
    unmount();

    await act(async () => {
      resolveBranches([
        { id: 'late', address: '9 Late Road, Kandy', contactNumber: '' },
      ]);
      retry();
    });

    expect(getBranches).toHaveBeenCalledTimes(1);
  });
  it('separates expired sessions from retryable Branch load failures', async () => {
    getBranches.mockRejectedValueOnce(
      Object.assign(new Error('Session expired'), { status: 401 }),
    );
    const { result } = renderHook(() => useBranches());
    await waitFor(() => expect(result.current.unauthorized).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.branches).toEqual([]);
  });
});
