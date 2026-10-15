export const LAUNCHER_SIZE = 64;
const LAUNCHER_MARGIN = 24;
const PANEL_MARGIN = 16;
const PANEL_GAP = 18;
const PANEL_WIDTH = 428;
const PANEL_HEIGHT = 580;
const COMPACT_VIEWPORT_HEIGHT = 320;

export function getChatbotViewport() {
  const viewport = window.visualViewport;
  return {
    x: viewport?.offsetLeft || 0,
    y: viewport?.offsetTop || 0,
    width: viewport?.width || window.innerWidth,
    height: viewport?.height || window.innerHeight,
  };
}

export function clampLauncher(position, viewport) {
  const availableWidth = Math.max(0, viewport.width - LAUNCHER_SIZE);
  const availableHeight = Math.max(0, viewport.height - LAUNCHER_SIZE);
  const marginX = Math.min(LAUNCHER_MARGIN, availableWidth / 2);
  const marginY = Math.min(LAUNCHER_MARGIN, availableHeight / 2);
  return {
    x: Math.min(
      viewport.x + availableWidth - marginX,
      Math.max(viewport.x + marginX, position.x),
    ),
    y: Math.min(
      viewport.y + availableHeight - marginY,
      Math.max(viewport.y + marginY, position.y),
    ),
  };
}

export function defaultLauncherPosition(viewport) {
  return clampLauncher(
    {
      x: viewport.x + viewport.width,
      y: viewport.y + viewport.height,
    },
    viewport,
  );
}

export function getOpenChatbotPosition(position, viewport) {
  // Keep the open panel and close bubble together at the bottom of the visible
  // viewport; retain the customer's minimized position for the next close.
  const launcher = clampLauncher(
    {
      x: position.x,
      y: viewport.y + viewport.height,
    },
    viewport,
  );
  const hideLauncher = viewport.height < COMPACT_VIEWPORT_HEIGHT;
  const width = Math.min(
    PANEL_WIDTH,
    Math.max(0, viewport.width - PANEL_MARGIN * 2),
  );
  const height = Math.min(
    PANEL_HEIGHT,
    Math.max(
      0,
      hideLauncher
        ? viewport.height - PANEL_MARGIN * 2
        : launcher.y - viewport.y - PANEL_GAP - PANEL_MARGIN,
    ),
  );
  return {
    launcher,
    hideLauncher,
    panel: {
      width,
      height,
      x: Math.max(
        viewport.x + PANEL_MARGIN,
        Math.min(
          viewport.x + viewport.width - PANEL_MARGIN - width,
          launcher.x + LAUNCHER_SIZE - width,
        ),
      ),
      y: hideLauncher
        ? viewport.y + viewport.height - PANEL_MARGIN - height
        : launcher.y - PANEL_GAP - height,
    },
  };
}
