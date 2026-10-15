import { useEffect } from 'react';

const FOCUSABLE =
  'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]';

export default function useChatbotDialog(
  isOpen,
  hostRef,
  inputRef,
  launcherRef,
  close,
) {
  useEffect(() => {
    if (!isOpen) return;

    const host = hostRef.current;
    const launcher = launcherRef.current;
    const background = Array.from(document.body.children)
      .filter((node) => node !== host)
      .map((node) => ({
        node,
        inert: node.getAttribute('inert'),
        hidden: node.getAttribute('aria-hidden'),
      }));
    for (const { node } of background) {
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus({ preventScroll: true });

    function handleKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'Tab') {
        const controls = Array.from(host.querySelectorAll(FOCUSABLE)).filter(
          (node) => !node.closest('[hidden]'),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    function keepFocus(event) {
      if (!host.contains(event.target))
        inputRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', keepFocus);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('focusin', keepFocus);
      for (const { node, inert, hidden } of background) {
        if (inert === null) node.removeAttribute('inert');
        else node.setAttribute('inert', inert);
        if (hidden === null) node.removeAttribute('aria-hidden');
        else node.setAttribute('aria-hidden', hidden);
      }
      document.body.style.overflow = previousOverflow;
      if (launcher?.isConnected) launcher.focus({ preventScroll: true });
    };
  }, [isOpen, hostRef, inputRef, launcherRef, close]);
}
