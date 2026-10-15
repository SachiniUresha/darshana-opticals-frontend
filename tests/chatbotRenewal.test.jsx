import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useChatConversation from '../src/hooks/useChatConversation';
import { sendMessage } from '../src/services/chatbotService';
import authStorage from '../src/services/auth/authStorage';
import {
  clearChatHistory,
  createChatHistorySession,
  saveChatHistory,
} from '../src/services/chatHistoryStorage';

const customer = { id: 'renewal-customer', role: 'CUSTOMER' };
vi.mock('../src/hooks/useAuth', () => ({
  default: () => ({ user: customer, logout: vi.fn() }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../src/services/chatbotService', () => ({ sendMessage: vi.fn() }));
const reply = {
  chatId: 'chat-renewed',
  inquiryType: 'SERVICES',
  responseStatus: 'ANSWERED',
  responseText: 'The store can help.',
};
const exhausted = (seconds) =>
  Object.assign(new Error('private details'), {
    status: 429,
    code: 'CHATBOT_SESSION_EXHAUSTED',
    ...(seconds === undefined ? {} : { retryAfterSeconds: seconds }),
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T06:00:00Z'));
  localStorage.clear();
  sessionStorage.clear();
  clearChatHistory();
  authStorage.saveAuth('renewal-jwt', customer);
  sendMessage.mockReset().mockResolvedValue(reply);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
});

describe('server-authoritative chatbot renewal', () => {
  it('waits for the server remainder, resumes without a refresh and never sends automatically', async () => {
    sendMessage.mockRejectedValueOnce(exhausted(12));
    const { result } = renderHook(() => useChatConversation());
    await act(() => result.current.submitQuestion('Store hours?'));
    expect(result.current.error).toContain('shared 30-minute');
    expect(result.current.cooldownActive).toBe(true);
    expect(result.current.canRetry).toBe(true);
    await act(() => result.current.retryQuestion());
    expect(sendMessage).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(11999));
    expect(result.current.cooldownActive).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.cooldownActive).toBe(false);
    expect(result.current.availabilityNotice).toContain('check availability');
    expect(sendMessage).toHaveBeenCalledTimes(1);
    await act(() => result.current.retryQuestion());
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(result.current.messages).toHaveLength(2);
  });

  it('accepts another exhaustion response after another tab consumes the new allowance', async () => {
    sendMessage
      .mockRejectedValueOnce(exhausted(1))
      .mockRejectedValueOnce(exhausted(45));
    const { result } = renderHook(() => useChatConversation());
    await act(() => result.current.submitQuestion('Store hours?'));
    act(() => vi.advanceTimersByTime(1000));
    await act(() => result.current.retryQuestion());
    expect(result.current.cooldownActive).toBe(true);
    act(() => vi.advanceTimersByTime(44000));
    expect(result.current.cooldownActive).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, -1, NaN, Infinity, 2147484])(
    'keeps manual retry possible with unusable Retry-After %s',
    async (seconds) => {
      sendMessage.mockRejectedValueOnce(exhausted(seconds));
      const { result } = renderHook(() => useChatConversation());
      await act(() => result.current.submitQuestion('Store hours?'));
      expect(result.current.cooldownActive).toBe(false);
      expect(result.current.error).toContain('message limit');
      expect(result.current.error).not.toContain('private');
      await act(() => result.current.retryQuestion());
      expect(sendMessage).toHaveBeenCalledTimes(2);
    },
  );

  it('distinguishes ordinary rate limits and temporary usage unavailability', async () => {
    const { result } = renderHook(() => useChatConversation());
    sendMessage.mockRejectedValueOnce(
      Object.assign(new Error(), {
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds: 2,
      }),
    );
    await act(() => result.current.submitQuestion('Store hours?'));
    expect(result.current.error).toContain('Too many requests');
    expect(result.current.error).not.toContain('30-minute');
    act(() => vi.advanceTimersByTime(2000));
    sendMessage.mockRejectedValueOnce(
      Object.assign(new Error(), {
        status: 503,
        code: 'CHATBOT_USAGE_UNAVAILABLE',
      }),
    );
    await act(() => result.current.retryQuestion());
    expect(result.current.error).toContain('temporarily unavailable');
    expect(result.current.cooldownActive).toBe(false);
  });

  it('keeps the most recent complete messages at the display bound and can send after renewal', async () => {
    const old = Array.from({ length: 20 }, (_, i) =>
      i % 2
        ? { ...reply, id: 'a-' + i, role: 'assistant', text: 'Old reply ' + i }
        : { id: 'u-' + i, role: 'user', text: 'Old question ' + i },
    );
    saveChatHistory(createChatHistorySession(), old);
    const { result } = renderHook(() => useChatConversation());
    await act(() => result.current.submitQuestion('A renewed question'));
    expect(sendMessage).toHaveBeenCalledWith({
      message: 'A renewed question',
      history: old.slice(-6).map(({ role, text }) => ({ role, text })),
    });
    expect(result.current.messages).toHaveLength(20);
    expect(result.current.messages[0].id).toBe('u-2');
    expect(result.current.messages.at(-1).text).toBe(reply.responseText);
    expect(
      JSON.parse(sessionStorage.getItem('osms_chat_history')).messages,
    ).toHaveLength(20);
  });

  it('cleans up renewal timers on unmount', async () => {
    const clear = vi.spyOn(window, 'clearTimeout');
    sendMessage.mockRejectedValueOnce(exhausted(1800));
    const { result, unmount } = renderHook(() => useChatConversation());
    await act(() => result.current.submitQuestion('Store hours?'));
    unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});
