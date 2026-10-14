import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authStorage from '../src/services/auth/authStorage';
import {
  clearChatHistory,
  createChatHistorySession,
  loadChatHistory,
  saveChatHistory,
} from '../src/services/chatHistoryStorage';

const customerA = { id: 'customer-a', role: 'CUSTOMER' };
const customerB = { id: 'customer-b', role: 'CUSTOMER' };
const transcript = [
  { id: 'message-1', role: 'user', text: 'What services do you offer?' },
  {
    id: 'message-2',
    role: 'assistant',
    text: 'Contact the store for assistance.',
    chatId: 'chat_1',
    inquiryType: 'SERVICES',
    responseStatus: 'ANSWERED',
  },
];

function loginAs(user = customerA) {
  authStorage.saveAuth('test-token-' + user.id, user);
  return createChatHistorySession();
}

describe('active Customer chat history storage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    clearChatHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearChatHistory();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores the current Customer transcript when a widget is reopened', () => {
    const session = loginAs();

    expect(saveChatHistory(session, transcript)).toBe(true);
    expect(loadChatHistory(session)).toEqual(transcript);
    expect(loadChatHistory(createChatHistorySession())).toEqual(transcript);
  });

  it('restores safe history after the history module reloads in the same authenticated tab', async () => {
    const session = loginAs();
    saveChatHistory(session, transcript);
    vi.resetModules();

    const refreshedStorage = await import('../src/services/chatHistoryStorage');

    expect(
      refreshedStorage.loadChatHistory(
        refreshedStorage.createChatHistorySession(),
      ),
    ).toEqual(transcript);
    refreshedStorage.clearChatHistory();
  });

  it('allows the current session to recover after corrupt history is discarded', () => {
    const session = loginAs();
    saveChatHistory(session, transcript);
    sessionStorage.setItem('osms_chat_history', '{broken-json');

    expect(loadChatHistory(session)).toEqual([]);
    expect(saveChatHistory(session, transcript)).toBe(true);
    expect(loadChatHistory(session)).toEqual(transcript);
  });

  it('returns an empty transcript when tab history disappears during an active session', () => {
    const session = loginAs();
    saveChatHistory(session, transcript);
    sessionStorage.removeItem('osms_chat_history');

    expect(loadChatHistory(session)).toEqual([]);
  });

  it('returns an empty transcript given no stored history', () => {
    expect(loadChatHistory(loginAs())).toEqual([]);
  });

  it.each([
    undefined,
    null,
    {},
    [],
    { customerId: 'customer-a', generation: -1 },
  ])(
    'does not read or write history given invalid or stale session %j',
    (session) => {
      loginAs();
      const read = vi.spyOn(Storage.prototype, 'getItem');
      const write = vi.spyOn(Storage.prototype, 'setItem');

      expect(loadChatHistory(session)).toEqual([]);
      expect(saveChatHistory(session, transcript)).toBe(false);
      expect(read).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it.each([
    'SYSTEM_ADMIN',
    'BRANCH_MANAGER',
    'BRANCH_ASSISTANT',
    'OPTOMETRIST',
  ])('purges Customer history when a %s account becomes active', (role) => {
    saveChatHistory(loginAs(), transcript);
    authStorage.saveAuth('test-staff-token', { id: 'staff-1', role });

    expect(createChatHistorySession()).toBeNull();
    expect(sessionStorage.getItem('osms_chat_history')).toBeNull();
  });

  it('does not grant history access given an anonymous session', () => {
    sessionStorage.setItem('osms_chat_history', 'old-data');

    expect(createChatHistorySession()).toBeNull();
    expect(sessionStorage.getItem('osms_chat_history')).toBeNull();
  });

  it('requires a token and a usable Customer ID', () => {
    localStorage.setItem('osms.auth.user', JSON.stringify(customerA));
    expect(createChatHistorySession()).toBeNull();

    authStorage.saveAuth('test-token', { role: 'CUSTOMER' });
    expect(createChatHistorySession()).toBeNull();
  });

  it('purges stored messages belonging to another Customer instead of rendering them', () => {
    saveChatHistory(loginAs(), transcript);
    const sessionB = loginAs(customerB);

    expect(loadChatHistory(sessionB)).toEqual([]);
    expect(sessionStorage.getItem('osms_chat_history')).toBeNull();
    expect(
      saveChatHistory(createChatHistorySession(), [
        { id: 'b-1', role: 'user', text: 'A new question' },
      ]),
    ).toBe(true);
  });

  it('rejects a late Customer A write without deleting Customer B history', () => {
    const sessionA = loginAs();
    const sessionB = loginAs(customerB);
    const messagesB = [
      { id: 'b-1', role: 'user', text: 'Customer B question' },
    ];
    saveChatHistory(sessionB, messagesB);

    expect(saveChatHistory(sessionA, transcript)).toBe(false);
    expect(loadChatHistory(sessionA)).toEqual([]);
    expect(loadChatHistory(sessionB)).toEqual(messagesB);
  });

  it('invalidates pending writers when the same Customer logs in again after logout', () => {
    const oldSession = loginAs();
    saveChatHistory(oldSession, transcript);
    clearChatHistory();
    authStorage.clearAuth();
    const newSession = loginAs();

    expect(loadChatHistory(newSession)).toEqual([]);
    expect(saveChatHistory(oldSession, transcript)).toBe(false);
    expect(saveChatHistory(newSession, transcript)).toBe(true);
  });

  it('keeps only approved fields without storing tokens or provider metadata', () => {
    const session = loginAs();
    const enriched = transcript.map((message) => ({
      ...message,
      token: 'not-for-chat-storage',
      providerPayload: { private: 'not-for-chat-storage' },
      profile: { email: 'private@example.test' },
      systemPrompt: 'not-for-chat-storage',
    }));

    saveChatHistory(session, enriched);

    const stored = JSON.parse(sessionStorage.getItem('osms_chat_history'));
    expect(stored).toEqual({
      version: 1,
      customerId: customerA.id,
      messages: transcript,
    });
    expect(localStorage.getItem('osms_chat_history')).toBeNull();
    expect(enriched[0].token).toBe('not-for-chat-storage');
  });

  it.each(['ANSWERED', 'UNSUPPORTED', 'FAILED', 'ESCALATED_CONTACT_PROVIDED'])(
    'preserves canonical assistant status %s and complete plain text',
    (responseStatus) => {
      const session = loginAs();
      const messages = [
        transcript[0],
        {
          ...transcript[1],
          responseStatus,
          text:
            '<script>alert(1)</script> [link](javascript:alert(1))\n' +
            'a'.repeat(600),
        },
      ];

      expect(saveChatHistory(session, messages)).toBe(true);
      expect(loadChatHistory(session)).toEqual(messages);
    },
  );

  it('accepts the 20-message session boundary without truncating messages', () => {
    const session = loginAs();
    const messages = Array.from({ length: 20 }, (_, index) => ({
      id: 'user-' + index,
      role: 'user',
      text: 'a'.repeat(500),
    }));

    expect(saveChatHistory(session, messages)).toBe(true);
    expect(loadChatHistory(session)).toEqual(messages);
  });

  it.each([
    ['non-array messages', null],
    [
      'oversized session',
      Array.from({ length: 21 }, (_, index) => ({
        id: String(index),
        role: 'user',
        text: 'Question',
      })),
    ],
    ['null message', [null]],
    ['array message', [[]]],
    ['empty ID', [{ ...transcript[0], id: ' ' }]],
    ['duplicate ID', [transcript[0], transcript[0]]],
    ['empty text', [{ ...transcript[0], text: ' ' }]],
    ['non-string text', [{ ...transcript[0], text: {} }]],
    ['unknown sender', [{ ...transcript[0], role: 'system' }]],
    ['oversized user text', [{ ...transcript[0], text: 'a'.repeat(501) }]],
    ['missing chat ID', [{ ...transcript[1], chatId: undefined }]],
    ['unknown inquiry type', [{ ...transcript[1], inquiryType: 'CUSTOM' }]],
    [
      'unknown response status',
      [{ ...transcript[1], responseStatus: 'SUCCESS' }],
    ],
  ])(
    'rejects %s without overwriting a valid transcript',
    (_label, messages) => {
      const session = loginAs();
      saveChatHistory(session, transcript);

      expect(() => saveChatHistory(session, messages)).toThrow(
        'Chat history could not be saved.',
      );
      expect(loadChatHistory(session)).toEqual(transcript);
    },
  );

  it.each([
    '{broken-json',
    'null',
    '[]',
    JSON.stringify({
      version: 2,
      customerId: customerA.id,
      messages: transcript,
    }),
    JSON.stringify({ version: 1, customerId: customerA.id, messages: 'bad' }),
    JSON.stringify({ version: 1, customerId: customerA.id, messages: [null] }),
  ])('discards invalid stored history %s', (raw) => {
    const session = loginAs();
    saveChatHistory(session, transcript);
    sessionStorage.setItem('osms_chat_history', raw);

    expect(loadChatHistory(session)).toEqual([]);
    expect(sessionStorage.getItem('osms_chat_history')).toBeNull();
  });

  it('returns false on quota failure and leaves the old transcript readable', () => {
    const session = loginAs();
    saveChatHistory(session, transcript);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    });

    expect(saveChatHistory(session, [])).toBe(false);
    expect(loadChatHistory(session)).toEqual(transcript);
  });

  it('fails closed when history storage cannot be read', () => {
    const session = loginAs();
    saveChatHistory(session, transcript);
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'osms_chat_history') throw new Error('Storage blocked');
      return originalGetItem.call(this, key);
    });

    expect(loadChatHistory(session)).toEqual([]);
    expect(sessionStorage.getItem('other-key')).toBeNull();
  });

  it('rejects history access when authentication storage is unavailable', () => {
    vi.spyOn(authStorage, 'getUser').mockImplementation(() => {
      throw new Error('Auth storage blocked');
    });

    expect(createChatHistorySession()).toBeNull();
  });

  it('prevents stale restoration when removal is blocked while allowing a fresh session to save', () => {
    const oldSession = loginAs();
    saveChatHistory(oldSession, transcript);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage removal blocked');
    });

    expect(clearChatHistory()).toBe(false);
    expect(loadChatHistory(createChatHistorySession())).toEqual([]);
    expect(saveChatHistory(oldSession, transcript)).toBe(false);
    vi.restoreAllMocks();

    const freshSession = createChatHistorySession();
    expect(saveChatHistory(freshSession, [])).toBe(true);
    expect(loadChatHistory(freshSession)).toEqual([]);
  });

  it('purges only chatbot history and keeps unrelated session data', () => {
    saveChatHistory(loginAs(), transcript);
    sessionStorage.setItem('unrelated-page-state', 'preserve');

    expect(clearChatHistory()).toBe(true);
    expect(sessionStorage.getItem('osms_chat_history')).toBeNull();
    expect(sessionStorage.getItem('unrelated-page-state')).toBe('preserve');
  });
});
