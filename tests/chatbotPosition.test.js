import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  clampLauncher,
  defaultLauncherPosition,
  getChatbotViewport,
  getOpenChatbotPosition,
} from '../src/components/chatbot/chatbotPosition';

afterEach(() => vi.unstubAllGlobals());

describe('chatbot viewport positioning', () => {
  const desktop = { x: 0, y: 0, width: 1024, height: 768 };

  it('starts at the bottom right with room for the notification dot', () => {
    expect(defaultLauncherPosition(desktop)).toEqual({ x: 936, y: 680 });
  });
  it('clamps dragging to all visible viewport edges', () => {
    expect(clampLauncher({ x: -900, y: -900 }, desktop)).toEqual({
      x: 24,
      y: 24,
    });
    expect(clampLauncher({ x: 9000, y: 9000 }, desktop)).toEqual({
      x: 936,
      y: 680,
    });
  });
  it('handles a small visible viewport without inverted movement bounds', () => {
    expect(
      clampLauncher({ x: 0, y: 900 }, { x: 5, y: 10, width: 80, height: 80 }),
    ).toEqual({ x: 13, y: 18 });
  });
  it.each([
    ['desktop', desktop],
    ['mobile', { x: 0, y: 0, width: 360, height: 640 }],
    ['mobile keyboard', { x: 0, y: 55, width: 390, height: 240 }],
    ['landscape', { x: 0, y: 0, width: 640, height: 280 }],
  ])('keeps the panel within the %s viewport', (_label, viewport) => {
    const placement = getOpenChatbotPosition({ x: 9000, y: -900 }, viewport);
    expect(placement.panel.x).toBeGreaterThanOrEqual(viewport.x + 16);
    expect(placement.panel.y).toBeGreaterThanOrEqual(viewport.y + 16);
    expect(placement.panel.x + placement.panel.width).toBeLessThanOrEqual(
      viewport.x + viewport.width - 16,
    );
    expect(placement.panel.y + placement.panel.height).toBeLessThanOrEqual(
      viewport.y + viewport.height - 16,
    );
  });
  it('uses all available panel height and hides the extra close bubble when a keyboard leaves little room', () => {
    const result = getOpenChatbotPosition(
      { x: 200, y: 700 },
      { x: 0, y: 60, width: 390, height: 240 },
    );
    expect(result.hideLauncher).toBe(true);
    expect(result.panel.height).toBe(208);
  });
  it('reads visible viewport offsets while the mobile keyboard is open', () => {
    vi.stubGlobal('visualViewport', {
      offsetLeft: 2,
      offsetTop: 100,
      width: 390,
      height: 250,
    });
    expect(getChatbotViewport()).toEqual({
      x: 2,
      y: 100,
      width: 390,
      height: 250,
    });
  });
  it('uses window dimensions without a visual viewport', () => {
    vi.stubGlobal('visualViewport', undefined);
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
    expect(getChatbotViewport()).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
  });
});
