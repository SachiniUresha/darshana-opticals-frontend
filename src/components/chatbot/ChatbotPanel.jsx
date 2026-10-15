import { useState } from 'react';
import { EyeIcon } from '../forms/FieldIcons';
import {
  CHATBOT_MAX_MESSAGE_LENGTH,
  CHATBOT_SESSION_LIMIT_NOTICE,
} from '../../config/chatbot';
import { CloseIcon, SendIcon } from './ChatbotIcons';
import ChatMessageList from './ChatMessageList';

export default function ChatbotPanel({
  titleId,
  panelId,
  inputRef,
  placement,
  onClose,
  messages,
  draft,
  onDraftChange,
  onSend,
  isSending: suppliedPending = false,
  conversation = {},
}) {
  const [validation, setValidation] = useState('');
  const helpId = panelId + '-input-help';
  const isSending = conversation.isSending ?? suppliedPending;
  const {
    error = '',
    storageNotice = '',
    blocked = false,
    standalone = false,
    setStandalone,
    historyNeedsStandalone = false,
    retryNeedsStandalone = false,
    limitReached = false,
    canRetry = false,
    retryQuestion,
  } = conversation;
  const needsChoice = historyNeedsStandalone || retryNeedsStandalone;
  const sendBlocked =
    blocked || limitReached || (historyNeedsStandalone && !standalone);

  function chooseQuestion(question) {
    onDraftChange(question);
    setValidation('');
    inputRef.current?.focus();
  }

  function submit(event) {
    event.preventDefault();
    if (isSending || blocked || !onSend) return;
    if (!draft.trim()) {
      setValidation('Enter a question before sending.');
      inputRef.current?.focus();
      return;
    }
    setValidation('');
    onSend(draft);
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <section
      className="chatbot-panel"
      id={panelId}
      style={{
        left: placement.x,
        top: placement.y,
        width: placement.width,
        height: placement.height,
      }}
    >
      <header className="chatbot-header">
        <span className="chatbot-header-avatar" aria-hidden="true">
          <EyeIcon width={20} height={20} />
        </span>
        <div className="chatbot-header-copy">
          <h2 id={titleId}>Darshana Assistant</h2>
          <p>
            <span className="chatbot-online-dot" aria-hidden="true" />
            Darshana Opticals
          </p>
        </div>
        <button
          type="button"
          className="chatbot-header-close"
          aria-label="Minimize Darshana Assistant"
          onClick={onClose}
        >
          <CloseIcon size={20} />
        </button>
      </header>
      <ChatMessageList
        messages={messages}
        onChooseQuestion={chooseQuestion}
        isSending={isSending}
        disableQuickQuestions={blocked || limitReached}
      />
      {isSending && (
        <p className="chatbot-processing" role="status">
          Darshana Assistant is thinking…
        </p>
      )}
      {(error || storageNotice || needsChoice || limitReached || canRetry) && (
        <div className="chatbot-feedback">
          {error && (
            <p role="alert" className="chatbot-request-error">
              {error}
            </p>
          )}
          {storageNotice && <p role="status">{storageNotice}</p>}
          {limitReached && (
            <p className="chatbot-limit-notice">
              {CHATBOT_SESSION_LIMIT_NOTICE}
            </p>
          )}
          {needsChoice && !blocked && (
            <label className="chatbot-context-choice">
              <input
                type="checkbox"
                checked={standalone}
                disabled={isSending}
                onChange={(event) => setStandalone?.(event.target.checked)}
              />
              Send this question without earlier conversation
            </label>
          )}
          {needsChoice && !blocked && (
            <p className="chatbot-context-notice">
              Earlier replies cannot be included. You can choose to ask this
              question on its own.
            </p>
          )}
          {canRetry && (
            <button
              type="button"
              className="chatbot-retry"
              disabled={isSending || (retryNeedsStandalone && !standalone)}
              onClick={() => {
                retryQuestion?.();
                inputRef.current?.focus({ preventScroll: true });
              }}
            >
              Retry last question
            </button>
          )}
        </div>
      )}
      <form className="chatbot-composer" onSubmit={submit}>
        {validation && (
          <p className="chatbot-validation" role="alert">
            {validation}
          </p>
        )}
        <label htmlFor={panelId + '-input'} className="chatbot-sr-only">
          Your question
        </label>
        <textarea
          id={panelId + '-input'}
          ref={inputRef}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
            setValidation('');
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit(event);
            }
          }}
          rows={1}
          maxLength={CHATBOT_MAX_MESSAGE_LENGTH}
          readOnly={isSending || blocked}
          aria-disabled={isSending || blocked}
          aria-describedby={helpId}
          placeholder="Type a message..."
        />
        <span id={helpId} className="chatbot-sr-only">
          Maximum {CHATBOT_MAX_MESSAGE_LENGTH} characters. Shift+Enter adds a
          new line.
        </span>
        <button
          type="submit"
          className="chatbot-send"
          aria-label="Send question"
          disabled={isSending || sendBlocked || !draft.trim() || !onSend}
        >
          <SendIcon />
        </button>
      </form>
    </section>
  );
}
