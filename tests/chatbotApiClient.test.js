import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendMessage } from '../src/services/chatbotService';
import authStorage from '../src/services/auth/authStorage';
import { env } from '../src/config/env';

const responseData = {
  chatId: 'chat_client_test',
  inquiryType: 'SERVICES',
  responseStatus: 'ANSWERED',
  responseText: 'Contact the branch for assistance.',
};

describe('chatbot service with the shared API client', () => {
  it.each([
    ['12', 12],
    ['0', 0],
    [' 60 ', 60],
    [null, undefined],
    ['', undefined],
    ['-1', undefined],
    ['1.5', undefined],
    ['tomorrow', undefined],
    ['Infinity', undefined],
    ['99999999999999999999', undefined],
    ['2147484', undefined],
  ])('safely preserves Retry-After %s seconds', async (header, expected) => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers(header === null ? {} : { 'Retry-After': header }),
      json: async () => ({
        error: { code: 'CHATBOT_SESSION_EXHAUSTED', message: 'Limit reached.' },
      }),
    });
    try {
      await sendMessage({ message: 'Question' });
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error.status).toBe(429);
      expect(error.code).toBe('CHATBOT_SESSION_EXHAUSTED');
      expect(error.retryAfterSeconds).toBe(expected);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authStorage.saveAuth('test-customer-jwt', {
      id: 'customer-test',
      role: 'CUSTOMER',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi
          .fn()
          .mockResolvedValue({ status: 'success', data: responseData }),
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('uses the environment URL and existing JWT when sending documented JSON', async () => {
    const history = [{ role: 'user', text: 'What services do you offer?' }];

    const result = await sendMessage({
      message: 'How do I contact the branch?',
      history,
    });
    const baseUrl = env.apiBaseUrl.replace(/\/+$/, '');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(baseUrl + '/v1/chatbot/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-customer-jwt',
      },
      body: JSON.stringify({
        message: 'How do I contact the branch?',
        history,
      }),
    });
    expect(result).toEqual(responseData);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(2);
  });

  it.each([401, 403, 422, 429, 503])(
    'preserves HTTP %s from the real shared client for the UI',
    async (status) => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: { code: 'TEST_ERROR', message: 'Request unavailable.' },
        }),
      });

      await expect(sendMessage({ message: 'Question' })).rejects.toMatchObject({
        status,
        code: 'TEST_ERROR',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('returns FAILED despite HTTP 200 when the backend supplies a provider fallback', async () => {
    const data = {
      ...responseData,
      responseStatus: 'FAILED',
      responseText: 'Our AI assistant is temporarily unavailable.',
    };
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ status: 'success', data }),
    });

    await expect(sendMessage({ message: 'Question' })).resolves.toEqual(data);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves the safe network failure supplied by the shared client', async () => {
    fetch.mockRejectedValueOnce(new Error('Internal transport details'));

    await expect(sendMessage({ message: 'Question' })).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message:
        'Unable to reach the server. Please check your connection and try again.',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects non-JSON success without exposing the parser payload', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('Internal payload')),
    });

    await expect(sendMessage({ message: 'Question' })).rejects.toMatchObject({
      code: 'INVALID_CHATBOT_RESPONSE',
      message: 'Invalid chatbot response received from the server.',
    });
  });
});
