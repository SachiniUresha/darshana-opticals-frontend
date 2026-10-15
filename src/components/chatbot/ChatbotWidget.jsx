import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useAuth from '../../hooks/useAuth';
import { CUSTOMER } from '../../config/roles';
import useDraggableChatLauncher from '../../hooks/useDraggableChatLauncher';
import useChatbotDialog from '../../hooks/useChatbotDialog';
import useChatConversation from '../../hooks/useChatConversation';
import { getOpenChatbotPosition } from './chatbotPosition';
import ChatbotPanel from './ChatbotPanel';
import { ChatIcon, CloseIcon } from './ChatbotIcons';
import './ChatbotWidget.css';

function CustomerChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const conversation = useChatConversation();
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const hostRef = useRef(null);
  const id = useId();
  const panelId = 'chatbot-panel-' + id;
  const titleId = 'chatbot-title-' + id;
  const close = useCallback(() => setIsOpen(false), []);
  const { viewport, position, shouldActivate, dragHandlers } =
    useDraggableChatLauncher(isOpen);
  const openPlacement = getOpenChatbotPosition(position, viewport);
  const launcherPosition = isOpen ? openPlacement.launcher : position;

  useChatbotDialog(isOpen, hostRef, inputRef, launcherRef, close);

  return createPortal(
    <div
      className="chatbot-host"
      ref={hostRef}
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? true : undefined}
      aria-labelledby={isOpen ? titleId : undefined}
    >
      {isOpen && (
        <>
          <div
            className="chatbot-backdrop"
            aria-hidden="true"
            onPointerDown={close}
          />
          <ChatbotPanel
            panelId={panelId}
            titleId={titleId}
            inputRef={inputRef}
            placement={openPlacement.panel}
            onClose={close}
            messages={conversation.messages}
            draft={conversation.draft}
            onDraftChange={conversation.setDraft}
            onSend={conversation.submitQuestion}
            conversation={conversation}
          />
        </>
      )}
      <button
        type="button"
        className="chatbot-launcher"
        ref={launcherRef}
        aria-label={
          isOpen ? 'Close Darshana Assistant' : 'Open Darshana Assistant'
        }
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-describedby={isOpen ? undefined : panelId + '-move-help'}
        hidden={isOpen && openPlacement.hideLauncher}
        style={{ left: launcherPosition.x, top: launcherPosition.y }}
        {...dragHandlers}
        onClick={(event) => {
          if (shouldActivate(event)) setIsOpen((current) => !current);
        }}
      >
        {isOpen ? (
          <CloseIcon size={28} />
        ) : (
          <>
            <ChatIcon />
            <span className="chatbot-launcher-dot" aria-hidden="true" />
          </>
        )}
      </button>
      <span className="chatbot-sr-only" id={panelId + '-move-help'}>
        Drag to move, or use Alt and arrow keys. Press Enter to open.
      </span>
    </div>,
    document.body,
  );
}

export default function ChatbotWidget() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || user?.role !== CUSTOMER || !user.id) return null;
  return <CustomerChatbot key={user.id} />;
}
