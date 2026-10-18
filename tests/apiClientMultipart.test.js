import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../src/services/apiClient';
import authStorage from '../src/services/auth/authStorage';

vi.mock('../src/services/auth/authStorage', () => ({
  default: { getToken: vi.fn(() => 'test-token') },
}));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.clearAllMocks());

describe('shared API client multipart support', () => {
  it('sends FormData without overriding its Content-Type boundary and keeps auth', async () => {
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    };
    const fakeFetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fakeFetch);
    const form = new FormData();
    form.append(
      'image',
      new File(['example'], 'frame.jpg', { type: 'image/jpeg' }),
    );
    await apiClient.post('/inventory/images', form);
    const [, options] = fakeFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(form);
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(authStorage.getToken).toHaveBeenCalled();
  });

  it('preserves JSON serialization for existing post calls', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    vi.stubGlobal('fetch', fakeFetch);
    await apiClient.post('/inventory', { itemName: 'Frames' });
    const [, options] = fakeFetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe('{"itemName":"Frames"}');
  });
});
