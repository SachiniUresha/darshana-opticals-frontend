import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatbotWidget from '../src/components/chatbot/ChatbotWidget';
import useAuth from '../src/hooks/useAuth';
import { MemoryRouter } from 'react-router-dom';
import { sendMessage } from '../src/services/chatbotService';
import {
  createChatHistorySession,
  loadChatHistory,
  saveChatHistory,
  isChatHistorySessionActive,
} from '../src/services/chatHistoryStorage';

vi.mock('../src/hooks/useAuth');
vi.mock('../src/services/chatbotService', () => ({ sendMessage: vi.fn() }));
vi.mock('../src/services/chatHistoryStorage', () => ({
  createChatHistorySession: vi.fn(),
  loadChatHistory: vi.fn(),
  saveChatHistory: vi.fn(() => true),
  clearChatHistory: vi.fn(),
  isChatHistorySessionActive: vi.fn(() => true),
}));

const transcript = [
  { id: 'user-1', role: 'user', text: 'Location & contact' },
  {
    id: 'assistant-1',
    role: 'assistant',
    text: 'The exact backend response.',
    chatId: 'chat-1',
    inquiryType: 'STORE_INFO',
    responseStatus: 'ANSWERED',
  },
];

function renderWidget(ui) {
  return render(ui, { wrapper: MemoryRouter });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('innerWidth', 1024);
  vi.stubGlobal('innerHeight', 768);
  vi.stubGlobal('visualViewport', undefined);
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      constructor(type, options = {}) {
        super(type, options);
        this.pointerId = options.pointerId ?? 1;
        this.isPrimary = options.isPrimary ?? true;
      }
    },
  );
  useAuth.mockReturnValue({
    user: { id: 'customer-a', role: 'CUSTOMER' },
    isAuthenticated: true,
  });
  createChatHistorySession.mockReturnValue({
    customerId: 'customer-a',
    generation: 0,
  });
  loadChatHistory.mockReturnValue([]);
  saveChatHistory.mockReturnValue(true);
  isChatHistorySessionActive.mockReturnValue(true);
  sendMessage.mockResolvedValue({
    chatId: 'chat-2',
    inquiryType: 'STORE_INFO',
    responseStatus: 'ANSWERED',
    responseText: 'Backend reply.',
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Customer chatbot shell', () => {
  it.each([
    [null, false],
    [{ id: 'staff', role: 'SYSTEM_ADMIN' }, true],
    [{ id: 'staff', role: 'BRANCH_MANAGER' }, true],
    [{ id: 'staff', role: 'OPTOMETRIST' }, true],
    [{ id: 'staff', role: 'BRANCH_ASSISTANT' }, true],
    [{ id: 'customer-a', role: 'CUSTOMER' }, false],
    [{ role: 'CUSTOMER' }, true],
  ])(
    'hides the widget outside authenticated Customer access (%j, %s)',
    (user, isAuthenticated) => {
      useAuth.mockReturnValue({ user, isAuthenticated });
      renderWidget(<ChatbotWidget />);
      expect(
        screen.queryByRole('button', { name: 'Open Darshana Assistant' }),
      ).not.toBeInTheDocument();
      expect(createChatHistorySession).not.toHaveBeenCalled();
    },
  );

  it('opens by keyboard, focuses the labelled input and closes with Escape', async () => {
    const user = userEvent.setup();
    renderWidget(<ChatbotWidget />);
    const launcher = screen.getByRole('button', {
      name: 'Open Darshana Assistant',
    });
    launcher.focus();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('dialog', { name: 'Darshana Assistant' }),
    ).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByRole('textbox', { name: 'Your question' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Close Darshana Assistant' }),
    ).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
  });

  it('minimizes and reopens without losing the draft or loading another conversation', async () => {
    const user = userEvent.setup();
    loadChatHistory.mockReturnValue(transcript);
    renderWidget(<ChatbotWidget />);
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    await user.type(screen.getByRole('textbox'), 'Draft question');
    await user.click(
      screen.getByRole('button', { name: 'Minimize Darshana Assistant' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    expect(screen.getByRole('textbox')).toHaveValue('Draft question');
    expect(screen.getByText('The exact backend response.')).toBeInTheDocument();
    expect(loadChatHistory).toHaveBeenCalledTimes(1);
  });

  it('fills quick questions as ordinary input without taking an OSMS action', async () => {
    const user = userEvent.setup();
    const onSend = sendMessage;
    renderWidget(<ChatbotWidget />);
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    await user.click(screen.getByRole('button', { name: 'Track my order' }));
    expect(screen.getByRole('textbox')).toHaveValue('Track my order');
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(onSend).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(onSend).toHaveBeenCalledWith({
      message: 'Track my order',
      history: [],
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('enables valid question sends through the connected service', async () => {
    const user = userEvent.setup();
    renderWidget(<ChatbotWidget />);
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    await user.type(screen.getByRole('textbox'), 'Question');
    expect(
      screen.getByRole('button', { name: 'Send question' }),
    ).not.toBeDisabled();
  });

  it('traps modal focus and restores existing page accessibility state on close', async () => {
    const user = userEvent.setup();
    const background = document.createElement('div');
    background.setAttribute('aria-hidden', 'false');
    document.body.append(background);
    try {
      renderWidget(<ChatbotWidget />);
      await user.click(
        screen.getByRole('button', { name: 'Open Darshana Assistant' }),
      );
      expect(background).toHaveAttribute('inert');
      expect(background).toHaveAttribute('aria-hidden', 'true');
      expect(document.body.style.overflow).toBe('hidden');
      screen
        .getByRole('button', { name: 'Minimize Darshana Assistant' })
        .focus();
      await user.tab({ shift: true });
      expect(
        screen.getByRole('button', { name: 'Close Darshana Assistant' }),
      ).toHaveFocus();
      await user.tab();
      expect(
        screen.getByRole('button', { name: 'Minimize Darshana Assistant' }),
      ).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(background).not.toHaveAttribute('inert');
      expect(background).toHaveAttribute('aria-hidden', 'false');
      expect(document.body.style.overflow).not.toBe('hidden');
    } finally {
      background.remove();
    }
  });

  it('redirects accidental external focus back into the modal', async () => {
    const user = userEvent.setup();
    const outside = document.createElement('button');
    document.body.append(outside);
    try {
      renderWidget(<ChatbotWidget />);
      await user.click(
        screen.getByRole('button', { name: 'Open Darshana Assistant' }),
      );
      outside.focus();
      expect(screen.getByRole('textbox')).toHaveFocus();
    } finally {
      outside.remove();
    }
  });

  it('closes on the transparent background without changing page navigation', async () => {
    const user = userEvent.setup();
    renderWidget(<ChatbotWidget />);
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    fireEvent.pointerDown(document.querySelector('.chatbot-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes the dialog and restores the page when Customer access is lost', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWidget(<ChatbotWidget />);
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    useAuth.mockReturnValue({ user: null, isAuthenticated: false });
    rerender(<ChatbotWidget />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('remounts history for a changed Customer without displaying the old transcript', async () => {
    const user = userEvent.setup();
    loadChatHistory.mockReturnValueOnce(transcript).mockReturnValueOnce([]);
    const { rerender } = renderWidget(<ChatbotWidget />);
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    expect(screen.getByText('The exact backend response.')).toBeInTheDocument();
    useAuth.mockReturnValue({
      user: { id: 'customer-b', role: 'CUSTOMER' },
      isAuthenticated: true,
    });
    rerender(<ChatbotWidget />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    expect(
      screen.queryByText('The exact backend response.'),
    ).not.toBeInTheDocument();
  });
});

describe('draggable launcher', () => {
  it('moves with a pointer and suppresses the resulting click while preserving keyboard activation', () => {
    renderWidget(<ChatbotWidget />);
    const launcher = screen.getByRole('button', {
      name: 'Open Darshana Assistant',
    });
    launcher.setPointerCapture = vi.fn();
    launcher.hasPointerCapture = () => true;
    launcher.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(launcher, {
      pointerId: 1,
      button: 0,
      clientX: 200,
      clientY: 100,
    });
    fireEvent.pointerMove(launcher, { pointerId: 1, clientX: 60, clientY: 50 });
    fireEvent.pointerUp(launcher, { pointerId: 1 });
    expect(launcher.style.left).toBe('796px');
    expect(launcher.style.top).toBe('630px');
    expect(launcher.releasePointerCapture).toHaveBeenCalledWith(1);
    fireEvent.click(launcher, { detail: 1 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(launcher, { detail: 0 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('allows closing after keyboard activation when a drag generated no click', () => {
    renderWidget(<ChatbotWidget />);
    const launcher = screen.getByRole('button', {
      name: 'Open Darshana Assistant',
    });
    fireEvent.pointerDown(launcher, { button: 0, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(launcher, { clientX: 60, clientY: 50 });
    fireEvent.pointerUp(launcher);
    fireEvent.click(launcher, { detail: 0 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(launcher, { detail: 1 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(launcher.style.left).toBe('796px');
    expect(launcher.style.top).toBe('630px');
  });

  it('allows normal clicks after small pointer movement', () => {
    renderWidget(<ChatbotWidget />);
    const launcher = screen.getByRole('button', {
      name: 'Open Darshana Assistant',
    });
    fireEvent.pointerDown(launcher, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(launcher, { clientX: 102, clientY: 102 });
    fireEvent.pointerUp(launcher);
    fireEvent.click(launcher, { detail: 1 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores secondary pointers/buttons and cancelled movement', () => {
    renderWidget(<ChatbotWidget />);
    const launcher = screen.getByRole('button', {
      name: 'Open Darshana Assistant',
    });
    fireEvent.pointerDown(launcher, { pointerId: 2, button: 2 });
    fireEvent.pointerMove(launcher, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(launcher, {
      pointerId: 3,
      button: 0,
      isPrimary: false,
    });
    fireEvent.pointerMove(launcher, { pointerId: 3, clientX: 0, clientY: 0 });
    expect(launcher.style.left).toBe('936px');
    fireEvent.pointerDown(launcher, {
      pointerId: 1,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(launcher, { pointerId: 9, clientX: 0, clientY: 0 });
    fireEvent.pointerCancel(launcher, { pointerId: 1 });
    fireEvent.pointerMove(launcher, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(launcher.style.left).toBe('936px');
  });

  it('offers keyboard positioning without opening the widget', () => {
    renderWidget(<ChatbotWidget />);
    const launcher = screen.getByRole('button', {
      name: 'Open Darshana Assistant',
    });
    fireEvent.keyDown(launcher, { key: 'ArrowLeft', altKey: true });
    fireEvent.keyDown(launcher, { key: 'ArrowUp', altKey: true });
    expect(launcher.style.left).toBe('920px');
    expect(launcher.style.top).toBe('664px');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reclamps after resizing and keeps the panel/header/input inside a mobile keyboard viewport', async () => {
    const user = userEvent.setup();
    const viewport = Object.assign(new EventTarget(), {
      width: 390,
      height: 700,
      offsetLeft: 0,
      offsetTop: 0,
    });
    vi.stubGlobal('visualViewport', viewport);
    renderWidget(<ChatbotWidget />);
    await user.click(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    );
    act(() => {
      viewport.height = 240;
      viewport.offsetTop = 50;
      viewport.dispatchEvent(new Event('resize'));
    });
    const panel = document.querySelector('.chatbot-panel');
    expect(panel.style.top).toBe('66px');
    expect(panel.style.height).toBe('208px');
    expect(
      screen.getByRole('button', { name: 'Minimize Darshana Assistant' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: 'Close Darshana Assistant' }),
    ).not.toBeInTheDocument();
    act(() => viewport.dispatchEvent(new Event('scroll')));
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: 'Open Darshana Assistant' }),
    ).toHaveFocus();
  });

  it('reclamps a dragged launcher when the window becomes smaller', () => {
    renderWidget(<ChatbotWidget />);
    vi.stubGlobal('innerWidth', 360);
    vi.stubGlobal('innerHeight', 640);
    fireEvent(window, new Event('resize'));
    const launcher = screen.getByRole('button', {
      name: 'Open Darshana Assistant',
    });
    expect(launcher.style.left).toBe('272px');
    expect(launcher.style.top).toBe('552px');
  });
});
