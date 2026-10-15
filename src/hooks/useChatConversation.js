import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from './useAuth';
import { sendMessage } from '../services/chatbotService';
import {
  createChatHistorySession,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  isChatHistorySessionActive,
} from '../services/chatHistoryStorage';
import {
  CHATBOT_MAX_CONTEXT_MESSAGES,
  CHATBOT_MAX_MESSAGE_LENGTH,
  CHATBOT_MAX_SESSION_MESSAGES,
  CHATBOT_SESSION_LIMIT_NOTICE,
  CHATBOT_RESPONSE_STATUSES,
} from '../config/chatbot';

const STORAGE_NOTICE =
  'Your latest messages may not survive a page refresh. They remain available while this chat stays open.';

function requestHistory(messages) {
  return messages
    .slice(-CHATBOT_MAX_CONTEXT_MESSAGES)
    .map(({ role, text }) => ({ role, text }));
}

function contextIsTooLong(history) {
  return history.some(
    (message) => message.text.length > CHATBOT_MAX_MESSAGE_LENGTH,
  );
}

function restoredAttempt(messages) {
  const last = messages[messages.length - 1];
  if (!last) return null;
  const userIndex =
    last.role === 'user' ? messages.length - 1 : messages.length - 2;
  if (
    last.role !== 'user' &&
    last.responseStatus !== CHATBOT_RESPONSE_STATUSES.FAILED
  )
    return null;
  const question = messages[userIndex];
  if (question?.role !== 'user') return null;
  return {
    message: question.text,
    userId: question.id,
    assistantId:
      last.role === 'assistant' ? last.id : 'assistant_' + crypto.randomUUID(),
    history: requestHistory(messages.slice(0, userIndex)),
  };
}

function restoreSession(customerId) {
  const session = createChatHistorySession();
  if (session?.customerId !== customerId)
    return { session: null, messages: [] };
  return { session, messages: loadChatHistory(session) };
}

function safeRequestError(error) {
  if (error?.status === 403)
    return 'Your account does not have access to the assistant.';
  if (error?.status === 429)
    return 'Too many requests. Wait before sending another question.';
  if (
    error?.status === 422 ||
    error?.status === 400 ||
    error?.code === 'INVALID_CHATBOT_REQUEST'
  ) {
    return 'Your question could not be accepted. Check it and try again.';
  }
  if (error?.status === 0 || error?.code === 'NETWORK_ERROR') {
    return "We couldn't reach the assistant. Check your connection and try again.";
  }
  if (error?.code === 'INVALID_CHATBOT_RESPONSE') {
    return 'The assistant returned an unreadable reply. Please try again later.';
  }
  return "We couldn't get a reply. Please try again later.";
}

export default function useChatConversation() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [initial] = useState(() => restoreSession(user.id));
  const sessionRef = useRef(initial.session);
  const messagesRef = useRef(initial.messages);
  const mounted = useRef(false);
  const pending = useRef(null);
  const [messages, setMessages] = useState(initial.messages);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [blocked, setBlocked] = useState(!initial.session);
  const [failedAttempt, setFailedAttempt] = useState(() =>
    restoredAttempt(initial.messages),
  );
  const [error, setError] = useState(() =>
    initial.messages.at(-1)?.role === 'user'
      ? 'No reply is available for your last question.'
      : '',
  );
  const [storageNotice, setStorageNotice] = useState('');
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    mounted.current = true;
    function handleStorageChange() {
      if (isChatHistorySessionActive(sessionRef.current)) return;
      clearChatHistory();
      pending.current = null;
      messagesRef.current = [];
      setMessages([]);
      setFailedAttempt(null);
      setDraft('');
      setIsSending(false);
      setBlocked(true);
      setError(
        'Your sign-in session has changed. Reload this page to continue.',
      );
    }
    window.addEventListener('storage', handleStorageChange);
    return () => {
      mounted.current = false;
      pending.current = null;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (isChatHistorySessionActive(sessionRef.current)) return;
    const next = restoreSession(user.id);
    sessionRef.current = next.session;
    messagesRef.current = next.messages;
    pending.current = null;
    setMessages(next.messages);
    setDraft('');
    setFailedAttempt(restoredAttempt(next.messages));
    setIsSending(false);
    setBlocked(!next.session);
    setError('');
    setStorageNotice('');
    setStandalone(false);
  }, [user]);

  function persist(next) {
    messagesRef.current = next;
    setMessages(next);
    try {
      if (!saveChatHistory(sessionRef.current, next)) {
        setStorageNotice(STORAGE_NOTICE);
      }
    } catch {
      setStorageNotice(STORAGE_NOTICE);
    }
  }

  function isRelevant(attempt) {
    return (
      mounted.current &&
      pending.current === attempt &&
      isChatHistorySessionActive(attempt.session)
    );
  }

  async function runAttempt(attempt, isRetry) {
    if (
      pending.current ||
      blocked ||
      !isChatHistorySessionActive(sessionRef.current)
    )
      return;
    if (
      isRetry &&
      !messagesRef.current.some(
        (message) => message.id === attempt.assistantId,
      ) &&
      messagesRef.current.length >= CHATBOT_MAX_SESSION_MESSAGES
    ) {
      setError(CHATBOT_SESSION_LIMIT_NOTICE);
      return;
    }
    if (contextIsTooLong(attempt.history) && !standalone) {
      setError('Choose to send this question without earlier conversation.');
      return;
    }
    const withoutHistory =
      standalone || (isRetry && attempt.withoutHistory === true);
    const capturedAttempt = {
      ...attempt,
      history: withoutHistory ? [] : attempt.history,
      withoutHistory,
    };
    const activeAttempt = { ...capturedAttempt, session: sessionRef.current };
    // Set the lock synchronously, before React commits the loading state.
    pending.current = activeAttempt;
    setIsSending(true);
    setError('');
    setFailedAttempt(null);
    if (!isRetry) setDraft('');
    if (!isRetry) {
      persist([
        ...messagesRef.current,
        { id: attempt.userId, role: 'user', text: attempt.message },
      ]);
    }
    const request = { message: attempt.message };
    if (!withoutHistory) request.history = capturedAttempt.history;
    try {
      const response = await sendMessage(request);
      if (!isRelevant(activeAttempt)) return;
      const reply = {
        id: attempt.assistantId,
        role: 'assistant',
        text: response.responseText,
        chatId: response.chatId,
        inquiryType: response.inquiryType,
        responseStatus: response.responseStatus,
      };
      const existing = messagesRef.current.findIndex(
        (message) => message.id === attempt.assistantId,
      );
      const next =
        existing < 0
          ? [...messagesRef.current, reply]
          : messagesRef.current.map((message) =>
              message.id === attempt.assistantId ? reply : message,
            );
      persist(next);
      if (response.responseStatus === CHATBOT_RESPONSE_STATUSES.FAILED)
        setFailedAttempt(capturedAttempt);
    } catch (requestError) {
      if (!isRelevant(activeAttempt)) return;
      if (requestError?.status === 401) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      if (requestError?.status === 403) setBlocked(true);
      setError(safeRequestError(requestError));
      if (
        requestError?.status === 0 ||
        requestError?.code === 'NETWORK_ERROR' ||
        [502, 503, 504].includes(requestError?.status)
      )
        setFailedAttempt(capturedAttempt);
    } finally {
      if (pending.current === activeAttempt) {
        pending.current = null;
        if (mounted.current) {
          setIsSending(false);
          setStandalone(false);
        }
      }
    }
  }

  function submitQuestion(text) {
    if (pending.current || blocked) return;
    if (typeof text !== 'string' || !text.trim()) {
      setError('Enter a question before sending.');
      return;
    }
    if (text.length > CHATBOT_MAX_MESSAGE_LENGTH) {
      setError('Questions must not exceed 500 characters.');
      return;
    }
    if (messagesRef.current.length + 2 > CHATBOT_MAX_SESSION_MESSAGES) {
      setError(CHATBOT_SESSION_LIMIT_NOTICE);
      return;
    }
    return runAttempt(
      {
        message: text.trim(),
        userId: 'user_' + crypto.randomUUID(),
        assistantId: 'assistant_' + crypto.randomUUID(),
        history: requestHistory(messagesRef.current),
      },
      false,
    );
  }

  function retryQuestion() {
    if (!failedAttempt) return;
    return runAttempt(failedAttempt, true);
  }

  const historyNeedsStandalone = contextIsTooLong(requestHistory(messages));
  const retryNeedsStandalone = failedAttempt
    ? contextIsTooLong(failedAttempt.history)
    : false;
  const limitReached = messages.length + 2 > CHATBOT_MAX_SESSION_MESSAGES;
  return {
    messages,
    draft,
    setDraft,
    isSending,
    error,
    storageNotice,
    blocked,
    standalone,
    setStandalone,
    historyNeedsStandalone,
    retryNeedsStandalone,
    limitReached,
    canRetry:
      Boolean(failedAttempt) &&
      !blocked &&
      (messages.length < CHATBOT_MAX_SESSION_MESSAGES ||
        messages.some((message) => message.id === failedAttempt.assistantId)),
    submitQuestion,
    retryQuestion,
  };
}
