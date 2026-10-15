import { useEffect, useRef, useState } from 'react';
import {
  clampLauncher,
  defaultLauncherPosition,
  getChatbotViewport,
} from '../components/chatbot/chatbotPosition';

const DRAG_THRESHOLD = 6;
const KEYBOARD_MOVE_STEP = 16;
const KEY_DIRECTIONS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export default function useDraggableChatLauncher(isOpen) {
  const [viewport, setViewport] = useState(getChatbotViewport);
  const [position, setPosition] = useState(() =>
    defaultLauncherPosition(getChatbotViewport()),
  );
  const drag = useRef(null);
  const suppressPointerClick = useRef(false);

  useEffect(() => {
    function updateViewport() {
      const next = getChatbotViewport();
      setViewport(next);
      setPosition((current) => clampLauncher(current, next));
      drag.current = null;
    }
    const visualViewport = window.visualViewport;
    window.addEventListener('resize', updateViewport);
    visualViewport?.addEventListener('resize', updateViewport);
    visualViewport?.addEventListener('scroll', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      visualViewport?.removeEventListener('resize', updateViewport);
      visualViewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  function onPointerDown(event) {
    if (isOpen || event.button !== 0 || event.isPrimary === false) return;
    suppressPointerClick.current = false;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      position,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!suppressPointerClick.current && Math.hypot(dx, dy) < DRAG_THRESHOLD)
      return;
    suppressPointerClick.current = true;
    event.preventDefault();
    setPosition(
      clampLauncher(
        { x: start.position.x + dx, y: start.position.y + dy },
        viewport,
      ),
    );
  }

  function onPointerEnd(event) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event) {
    const direction = KEY_DIRECTIONS[event.key];
    if (isOpen || !event.altKey || !direction) return;
    event.preventDefault();
    event.stopPropagation();
    setPosition((current) =>
      clampLauncher(
        {
          x: current.x + direction[0] * KEYBOARD_MOVE_STEP,
          y: current.y + direction[1] * KEYBOARD_MOVE_STEP,
        },
        viewport,
      ),
    );
  }

  function shouldActivate(event) {
    if (event.detail !== 0 && suppressPointerClick.current) {
      suppressPointerClick.current = false;
      return false;
    }
    suppressPointerClick.current = false;
    return true;
  }

  return {
    viewport,
    position,
    shouldActivate,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
      onKeyDown,
    },
  };
}
