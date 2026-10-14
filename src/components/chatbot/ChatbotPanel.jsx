import { useState } from 'react';
import { EyeIcon } from '../forms/FieldIcons';
import { CHATBOT_MAX_MESSAGE_LENGTH } from '../../config/chatbot';
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
  isSending = false,
}) {
  const [validation, setValidation] = useState('');
  const helpId = panelId + '-input-help';

  function chooseQuestion(question) {
    onDraftChange(question);
    setValidation('');
    inputRef.current?.focus();
  }

  function submit(event) {
    event.preventDefault();
    if (isSending || !onSend) return;
    if (!draft.trim()) {
      setValidation('Enter a question before sending.');
      inputRef.current?.focus();
      return;
    }
    setValidation('');
    onSend(draft);
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
      />
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
          disabled={isSending}
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
          disabled={isSending || !draft.trim() || !onSend}
        >
          <SendIcon />
        </button>
      </form>
    </section>
  );
}
