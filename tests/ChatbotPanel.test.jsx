import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatbotPanel from '../src/components/chatbot/ChatbotPanel';
import ChatMessageList from '../src/components/chatbot/ChatMessageList';

afterEach(cleanup);
function panelProps(extra = {}) {
  return {
    panelId: 'test-panel',
    titleId: 'test-title',
    inputRef: createRef(),
    placement: { x: 16, y: 16, width: 428, height: 580 },
    messages: [],
    onClose: vi.fn(),
    draft: '',
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    ...extra,
  };
}

describe('chatbot panel presentation', () => {
  it('reflects the documented input limit and blocks whitespace submissions', () => {
    const props = panelProps({ draft: '  ' });
    render(<ChatbotPanel {...props} />);
    expect(
      screen.getByRole('textbox', { name: 'Your question' }),
    ).toHaveAttribute('maxlength', '500');
    expect(
      screen.getByRole('button', { name: 'Send question' }),
    ).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a question before sending.',
    );
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('allows Enter to send and keeps Shift+Enter/composition as input', () => {
    const props = panelProps({ draft: 'Opening hours' });
    render(<ChatbotPanel {...props} />);
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      shiftKey: true,
    });
    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      isComposing: true,
    });
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(props.onSend).toHaveBeenCalledWith('Opening hours');
  });

  it('announces processing and disables sends and quick questions while waiting', () => {
    const props = panelProps({ draft: 'Question', isSending: true });
    render(<ChatbotPanel {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('thinking');
    expect(
      screen.getByRole('button', { name: 'Send question' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Opening hours' }),
    ).toBeDisabled();
    fireEvent.submit(document.querySelector('.chatbot-composer'));
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('delegates text changes without creating a provider request', async () => {
    const user = userEvent.setup();
    const props = panelProps();
    render(<ChatbotPanel {...props} />);
    await user.type(screen.getByRole('textbox'), 'a');
    expect(props.onDraftChange).toHaveBeenCalledWith('a');
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it.each([
    ['UNSUPPORTED', 'Outside supported topics'],
    ['FAILED', 'Assistant temporarily unavailable'],
    ['ESCALATED_CONTACT_PROVIDED', 'Contact store support'],
  ])(
    'keeps the backend %s fallback and renders a readable state label',
    (responseStatus, label) => {
      render(
        <ChatbotPanel
          {...panelProps({
            messages: [
              {
                id: 'assistant-1',
                role: 'assistant',
                text: 'Exact backend fallback.',
                responseStatus,
              },
            ],
          })}
        />,
      );
      expect(screen.getByText('Exact backend fallback.')).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it('renders untrusted output as plain text without executable HTML or links', () => {
    const text =
      '<script>alert(1)</script><img src=x onerror=alert(1)> [click](javascript:alert(1))';
    render(
      <ChatbotPanel
        {...panelProps({
          messages: [{ id: 'assistant-1', role: 'assistant', text }],
        })}
      />,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(document.querySelector('.chatbot-panel script')).toBeNull();
    expect(document.querySelector('.chatbot-panel img')).toBeNull();
    expect(document.querySelector('.chatbot-panel a')).toBeNull();
    expect(
      screen.getByRole('log', { name: 'Chat conversation' }),
    ).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getAllByText('Darshana Assistant:', { exact: false }),
    ).toHaveLength(2);
  });

  it('keeps a long customer question and long assistant reply intact', () => {
    const question = 'q'.repeat(500);
    const answer = 'a'.repeat(2000);
    render(
      <ChatbotPanel
        {...panelProps({
          messages: [
            { id: 'user-1', role: 'user', text: question },
            { id: 'assistant-1', role: 'assistant', text: answer },
          ],
        })}
      />,
    );
    expect(screen.getByText(question)).toBeInTheDocument();
    expect(screen.getByText(answer)).toBeInTheDocument();
    expect(screen.getByText('You:', { exact: true })).toBeInTheDocument();
  });

  it('respects a customer reading older messages instead of forcibly scrolling', () => {
    const props = { messages: [], onChooseQuestion: vi.fn() };
    const { rerender } = render(<ChatMessageList {...props} />);
    const log = screen.getByRole('log');
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
    });
    log.scrollTop = 0;
    fireEvent.scroll(log);
    rerender(
      <ChatMessageList
        {...props}
        messages={[{ id: '1', role: 'user', text: 'Question' }]}
      />,
    );
    expect(log.scrollTop).toBe(0);
    log.scrollTop = 800;
    fireEvent.scroll(log);
    rerender(<ChatMessageList {...props} isSending />);
    expect(log.scrollTop).toBe(1000);
  });
});
