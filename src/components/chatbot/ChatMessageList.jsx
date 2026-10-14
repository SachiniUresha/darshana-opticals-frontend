import { useEffect, useRef } from 'react';
import { EyeIcon } from '../forms/FieldIcons';
import { CHATBOT_RESPONSE_STATUSES } from '../../config/chatbot';

const QUICK_QUESTION_GROUPS = [
  ['Frame recommendations'],
  ['Track my order', 'Opening hours'],
  ['Our services', 'Location & contact'],
];
const STATUS_LABELS = {
  [CHATBOT_RESPONSE_STATUSES.UNSUPPORTED]: 'Outside supported topics',
  [CHATBOT_RESPONSE_STATUSES.FAILED]: 'Assistant temporarily unavailable',
  [CHATBOT_RESPONSE_STATUSES.ESCALATED_CONTACT_PROVIDED]:
    'Contact store support',
};

function AssistantAvatar() {
  return (
    <span className="chatbot-avatar" aria-hidden="true">
      <EyeIcon width={16} height={16} />
    </span>
  );
}

export default function ChatMessageList({
  messages,
  onChooseQuestion,
  isSending = false,
}) {
  const listRef = useRef(null);
  const followLatest = useRef(true);

  useEffect(() => {
    if (followLatest.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  return (
    <div
      className="chatbot-messages"
      role="log"
      aria-label="Chat conversation"
      aria-live="polite"
      aria-relevant="additions text"
      ref={listRef}
      onScroll={(event) => {
        const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
        followLatest.current = scrollHeight - scrollTop - clientHeight < 64;
      }}
    >
      <div className="chatbot-message chatbot-message--assistant">
        <AssistantAvatar />
        <div className="chatbot-message-content">
          <p className="chatbot-bubble">
            <span className="chatbot-sr-only">Darshana Assistant: </span>
            Hi there! Welcome to Darshana
            <br />
            Opticals. I&apos;m here to help you today.
          </p>
          <div
            className="chatbot-quick-questions"
            aria-label="Suggested questions"
          >
            {QUICK_QUESTION_GROUPS.map((group) => (
              <div className="chatbot-quick-row" key={group[0]}>
                {group.map((question) => (
                  <button
                    type="button"
                    key={question}
                    disabled={isSending}
                    onClick={() => onChooseQuestion(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {messages.map((message) => (
        <div
          className={'chatbot-message chatbot-message--' + message.role}
          key={message.id}
        >
          {message.role === 'assistant' && <AssistantAvatar />}
          <div className="chatbot-message-content">
            <p className="chatbot-bubble">
              <span className="chatbot-sr-only">
                {message.role === 'user' ? 'You: ' : 'Darshana Assistant: '}
              </span>
              {message.text}
            </p>
            {message.role === 'assistant' &&
              STATUS_LABELS[message.responseStatus] && (
                <p className="chatbot-response-status">
                  {STATUS_LABELS[message.responseStatus]}
                </p>
              )}
          </div>
        </div>
      ))}
      {isSending && (
        <p className="chatbot-processing" role="status">
          Darshana Assistant is thinking…
        </p>
      )}
    </div>
  );
}
