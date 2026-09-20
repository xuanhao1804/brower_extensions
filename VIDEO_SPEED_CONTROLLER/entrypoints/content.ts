import {
  clampSpeed,
  matchesShortcut,
  normalizeSpeed,
  sanitizeSettings,
  settingsStorage,
} from '../shared/settings';
import type { ContentMessage, VideoSpeedResponse } from '../shared/messages';

const CONTROLLER_ATTRIBUTE = 'data-vsc-controlled';
const SEEK_STEP_SECONDS = 10;
const VIDEO_EDGE_OFFSET = 10;
const TOP_CONTROLS_GAP = 8;
const YOUTUBE_SHORTS_TOP_CONTROLS_HEIGHT = 48;

let tiktokRelatedContentAnchor: HTMLElement | null = null;
let tiktokVolumeControlAnchor: HTMLElement | null = null;

interface VideoController {
  video: HTMLVideoElement;
  host: HTMLDivElement;
  badge: HTMLButtonElement;
  resizeObserver: ResizeObserver;
  cleanup: () => void;
}

interface ObservedVideo {
  cleanup: () => void;
}

export default defineContentScript({
  matches: ['*://*/*'],
  allFrames: true,

  async main(ctx) {
    document
      .querySelectorAll<HTMLElement>(`[${CONTROLLER_ATTRIBUTE}]`)
      .forEach((staleHost) => staleHost.remove());

    let settings = sanitizeSettings(await settingsStorage.getValue());
    let activeVideo: HTMLVideoElement | null = null;
    let layoutFrame: number | null = null;
    const controllers = new Map<HTMLVideoElement, VideoController>();
    const observedVideos = new Map<HTMLVideoElement, ObservedVideo>();

    function getBestVideo(): HTMLVideoElement | null {
      if (
        activeVideo?.isConnected &&
        controllers.has(activeVideo) &&
        canControlVideo(activeVideo)
      ) {
        return activeVideo;
      }
      activeVideo = null;

      let bestVideo: HTMLVideoElement | null = null;
      let bestArea = 0;
      for (const video of controllers.keys()) {
        if (!canControlVideo(video)) continue;
        const rect = video.getBoundingClientRect();
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
        );
        const visibleHeight = Math.max(
          0,
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
        );
        const area = visibleWidth * visibleHeight;
        if (area > bestArea) {
          bestArea = area;
          bestVideo = video;
        }
      }
      return bestVideo;
    }

    function setSpeed(video: HTMLVideoElement, requestedSpeed: number): number {
      const speed = normalizeSpeed(requestedSpeed);
      try {
        video.playbackRate = speed;
      } catch (error) {
        console.warn('[Video Speed Controller] Không thể đổi tốc độ video.', error);
        return video.playbackRate;
      }
      updateBadge(controllers.get(video));
      return video.playbackRate;
    }

    function adjustSpeed(video: HTMLVideoElement, direction: -1 | 1): void {
      setSpeed(video, video.playbackRate + settings.speedStep * direction);
    }

    function seekVideo(video: HTMLVideoElement, offsetSeconds: number): void {
      if (!Number.isFinite(video.currentTime)) return;

      const maxTime = Number.isFinite(video.duration)
        ? Math.max(0, video.duration)
        : Number.POSITIVE_INFINITY;
      const requestedTime = Math.min(
        Math.max(0, video.currentTime + offsetSeconds),
        maxTime,
      );

      try {
        video.currentTime = requestedTime;
      } catch (error) {
        console.warn('[Video Speed Controller] Không thể tua video.', error);
      }
    }

    function cyclePreset(video: HTMLVideoElement): void {
      const next = settings.presets.find(
        (preset) => preset > video.playbackRate + 0.001,
      );
      setSpeed(video, next ?? settings.presets[0] ?? settings.defaultSpeed);
    }

    function updateBadge(controller?: VideoController): void {
      if (!controller) return;
      const speedLabel = `x${formatSpeed(controller.video.playbackRate)}`;
      controller.badge.textContent = speedLabel;
      controller.badge.setAttribute('aria-label', `Current speed ${speedLabel}`);
      controller.host.style.opacity = String(settings.badgeOpacity);
      controller.host.style.display = settings.showBadge ? 'block' : 'none';
      controller.badge.title =
        'Click: next speed · Right-click: reset to x1 · Scroll: adjust speed';
      scheduleLayout();
    }

    function scheduleLayout(): void {
      if (layoutFrame !== null) return;
      layoutFrame = ctx.requestAnimationFrame(() => {
        layoutFrame = null;
        for (const controller of controllers.values()) {
          positionBadge(controller);
        }
      });
    }

    function positionBadge(controller: VideoController): void {
      const { video, host } = controller;
      if (!video.isConnected) {
        removeObservedVideo(video);
        return;
      }

      if (!canControlVideo(video)) {
        removeController(video);
        return;
      }

      const fullscreenElement = document.fullscreenElement;
      const mountTarget =
        fullscreenElement && fullscreenElement.contains(video)
          ? fullscreenElement
          : document.documentElement;
      if (host.parentElement !== mountTarget) mountTarget.append(host);

      const rect = getRenderedVideoContentRect(video);
      const topControlsBottom = getTopControlsBottom(video, rect);
      const badgeLeft = rect.left + VIDEO_EDGE_OFFSET;
      let badgeTop = rect.top + VIDEO_EDGE_OFFSET;
      if (topControlsBottom !== null) {
        badgeTop = Math.max(
          badgeTop,
          topControlsBottom + TOP_CONTROLS_GAP,
        );
      }
      const isVisible =
        rect.width >= 120 &&
        rect.height >= 68 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth &&
        badgeLeft >= 0 &&
        badgeTop >= 0 &&
        badgeLeft < window.innerWidth &&
        badgeTop < window.innerHeight;

      host.style.visibility = isVisible ? 'visible' : 'hidden';
      host.style.left = `${badgeLeft}px`;
      host.style.top = `${badgeTop}px`;
    }

    function activateVideo(video: HTMLVideoElement): VideoController | null {
      for (const controlledVideo of [...controllers.keys()]) {
        if (controlledVideo !== video) removeController(controlledVideo);
      }

      const existingController = controllers.get(video);
      if (existingController) {
        activeVideo = video;
        updateBadge(existingController);
        return existingController;
      }
      if (!video.isConnected || !canControlVideo(video)) return null;

      const host = document.createElement('div');
      host.setAttribute(CONTROLLER_ATTRIBUTE, '');
      Object.assign(host.style, {
        all: 'initial',
        position: 'fixed',
        zIndex: '2147483647',
        width: 'auto',
        height: 'auto',
        pointerEvents: 'none',
        transition: 'opacity 120ms ease',
      });

      const shadow = host.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      style.textContent = `
        .vsc-controls {
          box-sizing: border-box;
          display: flex;
          width: 36px;
          height: 36px;
          margin-left: 0;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 7px;
          background: rgba(10, 12, 16, 0.92);
          box-shadow:
            0 4px 14px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          pointer-events: auto;
          transition: width 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .vsc-controls:hover,
        .vsc-controls:focus-within {
          width: 172px;
        }

        .vsc-button {
          all: unset;
          box-sizing: border-box;
          display: grid;
          flex: 0 0 34px;
          width: 34px;
          height: 34px;
          place-items: center;
          color: #fff;
          font: 700 14px/1 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
          cursor: pointer;
          user-select: none;
        }

        .vsc-button:hover {
          background: rgba(255, 255, 255, 0.16);
        }

        .vsc-button:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.85);
          outline-offset: -3px;
        }

        .vsc-speed {
          background: rgba(255, 255, 255, 0.07);
          letter-spacing: -0.2px;
        }

        .vsc-side {
          flex-basis: 0;
          width: 0;
          border-left: 1px solid rgba(255, 255, 255, 0.18);
          color: rgba(255, 255, 255, 0.88);
          opacity: 0;
          pointer-events: none;
          transform: scaleX(0);
          transform-origin: left;
          transition:
            flex-basis 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
            width 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
            opacity 100ms ease,
            transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
            background-color 120ms ease,
            color 120ms ease;
        }

        .vsc-side:hover,
        .vsc-side:focus-visible {
          background: rgba(255, 255, 255, 0.26);
        }

        .vsc-speed-adjustment {
          background: rgba(255, 255, 255, 0.66);
          color: rgba(10, 12, 16, 0.92);
          font-size: 18px;
          font-weight: 600;
          text-shadow: none;
        }

        .vsc-speed-adjustment:hover,
        .vsc-speed-adjustment:focus-visible {
          background: rgba(255, 255, 255, 0.82);
        }

        .vsc-seek {
          letter-spacing: -1.4px;
        }

        .vsc-controls:hover .vsc-side,
        .vsc-controls:focus-within .vsc-side {
          flex-basis: 34px;
          width: 34px;
          opacity: 1;
          pointer-events: auto;
          transform: scaleX(1);
        }

        @media (prefers-reduced-motion: reduce) {
          .vsc-controls,
          .vsc-side {
            transition: none;
          }
        }
      `;

      const controls = document.createElement('div');
      controls.className = 'vsc-controls';

      const decreaseButton = document.createElement('button');
      decreaseButton.type = 'button';
      decreaseButton.className = 'vsc-button vsc-side vsc-speed-adjustment';
      decreaseButton.textContent = '−';
      decreaseButton.title = 'Decrease speed';
      decreaseButton.setAttribute('aria-label', 'Decrease speed');

      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'vsc-button vsc-speed';

      const increaseButton = document.createElement('button');
      increaseButton.type = 'button';
      increaseButton.className = 'vsc-button vsc-side vsc-speed-adjustment';
      increaseButton.textContent = '+';
      increaseButton.title = 'Increase speed';
      increaseButton.setAttribute('aria-label', 'Increase speed');

      const rewindButton = document.createElement('button');
      rewindButton.type = 'button';
      rewindButton.className = 'vsc-button vsc-side vsc-seek';
      rewindButton.textContent = '<<';
      rewindButton.title = `Rewind ${SEEK_STEP_SECONDS} seconds`;
      rewindButton.setAttribute(
        'aria-label',
        `Rewind ${SEEK_STEP_SECONDS} seconds`,
      );

      const forwardButton = document.createElement('button');
      forwardButton.type = 'button';
      forwardButton.className = 'vsc-button vsc-side vsc-seek';
      forwardButton.textContent = '>>';
      forwardButton.title = `Forward ${SEEK_STEP_SECONDS} seconds`;
      forwardButton.setAttribute(
        'aria-label',
        `Forward ${SEEK_STEP_SECONDS} seconds`,
      );

      controls.append(
        badge,
        rewindButton,
        decreaseButton,
        increaseButton,
        forwardButton,
      );
      shadow.append(style, controls);
      document.documentElement.append(host);

      const onRateChange = () => updateBadge(controllers.get(video));
      const onClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        cyclePreset(video);
      };
      const onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        setSpeed(video, 1);
      };
      const onDecrease = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        adjustSpeed(video, -1);
      };
      const onIncrease = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        adjustSpeed(video, 1);
      };
      const onRewind = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        seekVideo(video, -SEEK_STEP_SECONDS);
      };
      const onForward = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        seekVideo(video, SEEK_STEP_SECONDS);
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        adjustSpeed(video, event.deltaY < 0 ? 1 : -1);
      };

      video.addEventListener('ratechange', onRateChange);
      badge.addEventListener('click', onClick);
      badge.addEventListener('contextmenu', onContextMenu);
      decreaseButton.addEventListener('click', onDecrease);
      increaseButton.addEventListener('click', onIncrease);
      rewindButton.addEventListener('click', onRewind);
      forwardButton.addEventListener('click', onForward);
      controls.addEventListener('wheel', onWheel, { passive: false });

      const resizeObserver = new ResizeObserver(scheduleLayout);
      resizeObserver.observe(video);

      const controller: VideoController = {
        video,
        host,
        badge,
        resizeObserver,
        cleanup: () => {
          resizeObserver.disconnect();
          video.removeEventListener('ratechange', onRateChange);
          badge.removeEventListener('click', onClick);
          badge.removeEventListener('contextmenu', onContextMenu);
          decreaseButton.removeEventListener('click', onDecrease);
          increaseButton.removeEventListener('click', onIncrease);
          rewindButton.removeEventListener('click', onRewind);
          forwardButton.removeEventListener('click', onForward);
          controls.removeEventListener('wheel', onWheel);
          host.remove();
        },
      };

      controllers.set(video, controller);
      activeVideo = video;
      setSpeed(video, settings.defaultSpeed);
      updateBadge(controller);
      return controller;
    }

    function observeVideo(video: HTMLVideoElement): void {
      if (observedVideos.has(video)) return;

      const onPointerDown = () => {
        activateVideo(video);
      };
      const tryAutoActivate = () => {
        if (
          shouldAutoActivateVideo(video) ||
          shouldActivateOnDiscovery(video)
        ) {
          activateVideo(video);
        }
      };

      video.addEventListener('pointerdown', onPointerDown, true);
      video.addEventListener('playing', tryAutoActivate);
      video.addEventListener('loadedmetadata', tryAutoActivate);
      video.addEventListener('volumechange', tryAutoActivate);
      observedVideos.set(video, {
        cleanup: () => {
          video.removeEventListener('pointerdown', onPointerDown, true);
          video.removeEventListener('playing', tryAutoActivate);
          video.removeEventListener('loadedmetadata', tryAutoActivate);
          video.removeEventListener('volumechange', tryAutoActivate);
        },
      });

      tryAutoActivate();
    }

    function removeController(video: HTMLVideoElement): void {
      const controller = controllers.get(video);
      if (!controller) return;
      controller.cleanup();
      controllers.delete(video);
      if (activeVideo === video) activeVideo = null;
    }

    function removeObservedVideo(video: HTMLVideoElement): void {
      removeController(video);
      const observedVideo = observedVideos.get(video);
      if (!observedVideo) return;
      observedVideo.cleanup();
      observedVideos.delete(video);
    }

    function scanForVideos(root: ParentNode = document): void {
      if (root instanceof HTMLVideoElement) observeVideo(root);
      root.querySelectorAll('video').forEach(observeVideo);
    }

    function removeVideosFrom(root: Element): void {
      if (root instanceof HTMLVideoElement) removeObservedVideo(root);
      root.querySelectorAll('video').forEach(removeObservedVideo);
    }

    function reconcileVideos(): void {
      for (const video of controllers.keys()) {
        if (!canControlVideo(video)) removeController(video);
      }
      for (const video of observedVideos.keys()) {
        if (
          shouldAutoActivateVideo(video) ||
          shouldActivateOnDiscovery(video)
        ) {
          activateVideo(video);
        }
      }
      scheduleLayout();
    }

    function clearYouTubeControllers(): void {
      if (!isYouTubeSite()) return;
      for (const video of [...controllers.keys()]) removeController(video);
    }

    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
      );
    }

    function hasWheelModifier(event: WheelEvent): boolean {
      switch (settings.wheelModifier) {
        case 'Alt':
          return event.altKey;
        case 'Control':
          return event.ctrlKey;
        case 'Shift':
          return event.shiftKey;
        case 'Meta':
          return event.metaKey;
        case 'None':
          return true;
      }
    }

    function findVideoAtPoint(x: number, y: number): HTMLVideoElement | null {
      const element = document.elementFromPoint(x, y);
      if (!element) return null;
      if (element instanceof HTMLVideoElement) return element;

      for (const video of observedVideos.keys()) {
        if (!canControlVideo(video)) continue;
        const rect = video.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return video;
        }
      }
      return null;
    }

    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) scanForVideos(node);
        }
        for (const node of record.removedNodes) {
          if (node instanceof Element) removeVideosFrom(node);
        }
      }
      if (isYouTubeSite()) {
        for (const video of [...controllers.keys()]) {
          if (!canControlVideo(video)) removeController(video);
        }
      }
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    ctx.addEventListener(window, 'keydown', (rawEvent) => {
      const event = rawEvent as KeyboardEvent;
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const video = getBestVideo();
      if (!video) return;

      if (matchesShortcut(event, settings.shortcuts.decrease)) {
        event.preventDefault();
        event.stopPropagation();
        adjustSpeed(video, -1);
      } else if (matchesShortcut(event, settings.shortcuts.increase)) {
        event.preventDefault();
        event.stopPropagation();
        adjustSpeed(video, 1);
      } else if (matchesShortcut(event, settings.shortcuts.reset)) {
        event.preventDefault();
        event.stopPropagation();
        setSpeed(video, 1);
      }
    }, true);

    ctx.addEventListener(window, 'wheel', (event) => {
      if (!settings.wheelEnabled || !hasWheelModifier(event)) return;
      const isBadgeWheel = event.composedPath().some(
        (node) =>
          node instanceof HTMLElement && node.hasAttribute(CONTROLLER_ATTRIBUTE),
      );
      if (isBadgeWheel) return;
      const video = findVideoAtPoint(event.clientX, event.clientY);
      if (!video) return;
      if (!activateVideo(video)) return;
      event.preventDefault();
      activeVideo = video;
      adjustSpeed(video, event.deltaY < 0 ? 1 : -1);
    }, { capture: true, passive: false });

    ctx.addEventListener(window, 'resize', scheduleLayout);
    ctx.addEventListener(window, 'scroll', scheduleLayout, true);
    ctx.addEventListener(document, 'fullscreenchange', scheduleLayout);
    ctx.addEventListener(document, 'yt-navigate-start', clearYouTubeControllers);
    ctx.addEventListener(document, 'yt-navigate-finish', reconcileVideos);
    ctx.addEventListener(document, 'yt-page-data-updated', reconcileVideos);
    ctx.addEventListener(window, 'popstate', reconcileVideos);

    const unwatchSettings = settingsStorage.watch((newValue) => {
      settings = sanitizeSettings(newValue);
      for (const controller of controllers.values()) updateBadge(controller);
    });

    browser.runtime.onMessage.addListener(
      (message: ContentMessage): VideoSpeedResponse | undefined => {
        const video = getBestVideo();
        if (message.type === 'GET_VIDEO_SPEED') {
          return video
            ? { ok: true, speed: video.playbackRate }
            : { ok: false, error: 'Không tìm thấy video trong trang.' };
        }
        if (message.type === 'SET_VIDEO_SPEED') {
          return video
            ? { ok: true, speed: setSpeed(video, clampSpeed(message.speed)) }
            : { ok: false, error: 'Không tìm thấy video trong trang.' };
        }
        return undefined;
      },
    );

    scanForVideos();

    ctx.onInvalidated(() => {
      mutationObserver.disconnect();
      unwatchSettings();
      if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
      for (const controller of controllers.values()) controller.cleanup();
      controllers.clear();
      for (const observedVideo of observedVideos.values()) observedVideo.cleanup();
      observedVideos.clear();
    });
  },
});

const YOUTUBE_HOST_PATTERN = /(^|\.)youtube(?:-nocookie)?\.com$/i;
const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i;
const YOUTUBE_PLAYER_PATH_PATTERN =
  /^\/(?:watch(?:\/|$)|shorts(?:\/|$)|embed(?:\/|$)|live(?:\/|$))/;
const YOUTUBE_PREVIEW_SELECTOR = [
  'ytd-video-preview',
  'ytd-moving-thumbnail-renderer',
  'ytd-rich-grid-media',
  'ytd-rich-item-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-thumbnail',
].join(',');
const KNOWN_PLAYER_SELECTOR = [
  '.jwplayer',
  '.video-js',
  '.plyr',
  '.shaka-video-container',
  'media-player',
  '[data-vjs-player]',
].join(',');
const KNOWN_PLAYER_VIDEO_SELECTOR = '.jw-video, .vjs-tech, .shaka-video';

interface LayoutRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function getRenderedVideoContentRect(video: HTMLVideoElement): LayoutRect {
  const elementRect = video.getBoundingClientRect();
  const style = getComputedStyle(video);
  const leftInset =
    getPixelValue(style.borderLeftWidth) + getPixelValue(style.paddingLeft);
  const rightInset =
    getPixelValue(style.borderRightWidth) + getPixelValue(style.paddingRight);
  const topInset = getPixelValue(style.borderTopWidth) + getPixelValue(style.paddingTop);
  const bottomInset =
    getPixelValue(style.borderBottomWidth) + getPixelValue(style.paddingBottom);
  const contentRect = createLayoutRect(
    elementRect.left + leftInset,
    elementRect.top + topInset,
    Math.max(0, elementRect.width - leftInset - rightInset),
    Math.max(0, elementRect.height - topInset - bottomInset),
  );

  if (
    (style.objectFit !== 'contain' && style.objectFit !== 'scale-down') ||
    video.videoWidth <= 0 ||
    video.videoHeight <= 0 ||
    contentRect.width <= 0 ||
    contentRect.height <= 0
  ) {
    return contentRect;
  }

  const containScale = Math.min(
    contentRect.width / video.videoWidth,
    contentRect.height / video.videoHeight,
  );
  const scale =
    style.objectFit === 'scale-down' ? Math.min(1, containScale) : containScale;
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  const [positionX = '50%', positionY = '50%'] = style.objectPosition
    .trim()
    .split(/\s+/);
  const left =
    contentRect.left +
    getObjectPositionOffset(positionX, contentRect.width - width, 'left', 'right');
  const top =
    contentRect.top +
    getObjectPositionOffset(positionY, contentRect.height - height, 'top', 'bottom');

  return createLayoutRect(left, top, width, height);
}

function getTopControlsBottom(
  video: HTMLVideoElement,
  videoRect: LayoutRect,
): number | null {
  return (
    getTikTokTopControlsBottom(videoRect) ??
    getYouTubeShortsTopControlsBottom(video, videoRect)
  );
}

function getYouTubeShortsTopControlsBottom(
  video: HTMLVideoElement,
  videoRect: LayoutRect,
): number | null {
  if (
    !YOUTUBE_HOST_PATTERN.test(window.location.hostname) ||
    !window.location.pathname.startsWith('/shorts/') ||
    !video.closest('#shorts-player')
  ) {
    return null;
  }

  return Math.min(
    videoRect.top + YOUTUBE_SHORTS_TOP_CONTROLS_HEIGHT,
    videoRect.bottom,
  );
}

function getTikTokRelatedContentBottom(videoRect: LayoutRect): number | null {
  if (!TIKTOK_HOST_PATTERN.test(window.location.hostname)) return null;

  const cachedAnchor = getUsableTikTokAnchor(tiktokRelatedContentAnchor, videoRect);
  if (cachedAnchor) return cachedAnchor.getBoundingClientRect().bottom;
  tiktokRelatedContentAnchor = null;

  const candidates = new Set<HTMLElement>();
  document
    .querySelectorAll<HTMLElement>(
      [
        'input[placeholder*="related content" i]',
        '[aria-label*="related content" i]',
        '[data-e2e*="related-content" i]',
      ].join(','),
    )
    .forEach((element) => candidates.add(element));

  if (candidates.size === 0) {
    if (!document.body) return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent?.trim().toLowerCase() !== 'find related content') continue;
      if (node.parentElement) candidates.add(node.parentElement);
    }
  }

  for (const candidate of candidates) {
    const anchor = getUsableTikTokAnchor(candidate, videoRect);
    if (!anchor) continue;
    tiktokRelatedContentAnchor = anchor;
    return anchor.getBoundingClientRect().bottom;
  }

  return null;
}

function getTikTokTopControlsBottom(videoRect: LayoutRect): number | null {
  if (!TIKTOK_HOST_PATTERN.test(window.location.hostname)) return null;

  const relatedContentBottom = getTikTokRelatedContentBottom(videoRect);
  const volumeControlBottom = getTikTokVolumeControlBottom(videoRect);
  if (relatedContentBottom === null) return volumeControlBottom;
  if (volumeControlBottom === null) return relatedContentBottom;
  return Math.max(relatedContentBottom, volumeControlBottom);
}

function getTikTokVolumeControlBottom(videoRect: LayoutRect): number | null {
  const cachedAnchor = getUsableTikTokAnchor(
    tiktokVolumeControlAnchor,
    videoRect,
  );
  if (cachedAnchor) return cachedAnchor.getBoundingClientRect().bottom;
  tiktokVolumeControlAnchor = null;

  for (const candidate of document.querySelectorAll<HTMLElement>(
    '[data-key-interaction="video_mute"]',
  )) {
    const anchor = getUsableTikTokAnchor(candidate, videoRect);
    if (!anchor) continue;
    tiktokVolumeControlAnchor = anchor;
    return anchor.getBoundingClientRect().bottom;
  }

  return null;
}

function getUsableTikTokAnchor(
  candidate: HTMLElement | null,
  videoRect: LayoutRect,
): HTMLElement | null {
  if (!candidate?.isConnected) return null;

  let anchor = candidate;
  let current: HTMLElement | null = candidate;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const rect = current.getBoundingClientRect();
    if (
      rect.width >= 160 &&
      rect.width <= videoRect.width + 4 &&
      rect.height >= 24 &&
      rect.height <= 90
    ) {
      anchor = current;
    }
    current = current.parentElement;
  }

  const rect = anchor.getBoundingClientRect();
  const style = getComputedStyle(anchor);
  const topRegionBottom = videoRect.top + Math.min(180, videoRect.height * 0.25);
  const overlapsVideoHorizontally =
    rect.right > videoRect.left && rect.left < videoRect.right;
  const isInVideoTopRegion =
    rect.top >= videoRect.top - 1 && rect.bottom <= topRegionBottom;
  const isVisible =
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number.parseFloat(style.opacity || '1') > 0;

  return isVisible && overlapsVideoHorizontally && isInVideoTopRegion
    ? anchor
    : null;
}

function getObjectPositionOffset(
  value: string,
  freeSpace: number,
  startKeyword: 'left' | 'top',
  endKeyword: 'right' | 'bottom',
): number {
  if (value === startKeyword) return 0;
  if (value === 'center') return freeSpace / 2;
  if (value === endKeyword) return freeSpace;
  if (value.endsWith('%')) {
    const percentage = Number.parseFloat(value);
    if (Number.isFinite(percentage)) return freeSpace * (percentage / 100);
  }
  if (value.endsWith('px')) {
    const pixels = Number.parseFloat(value);
    if (Number.isFinite(pixels)) return pixels;
  }
  return freeSpace / 2;
}

function getPixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createLayoutRect(
  left: number,
  top: number,
  width: number,
  height: number,
): LayoutRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function isYouTubeSite(): boolean {
  return YOUTUBE_HOST_PATTERN.test(window.location.hostname);
}

function isYouTubePlaybackPage(): boolean {
  return (
    isYouTubeSite() &&
    YOUTUBE_PLAYER_PATH_PATTERN.test(window.location.pathname)
  );
}

function isYouTubeMiniPlayer(video: HTMLVideoElement): boolean {
  const usesMiniPlayerContainer = Boolean(
    video.closest(
      'ytd-miniplayer, #movie_player.ytp-player-minimized, .html5-video-player.ytp-player-minimized',
    ),
  );
  if (usesMiniPlayerContainer) return true;

  const rect = video.getBoundingClientRect();
  const hasMiniPlayerSize =
    rect.width >= 200 &&
    rect.height >= 110 &&
    rect.width <= 640 &&
    rect.height <= 400;
  const isNearBottomRight =
    rect.right >= window.innerWidth - 80 &&
    rect.bottom >= window.innerHeight - 80;

  return hasMiniPlayerSize && isNearBottomRight && isMeaningfullyVisible(video);
}

function canControlVideo(video: HTMLVideoElement): boolean {
  if (!isYouTubeSite()) return true;
  if (video.closest(YOUTUBE_PREVIEW_SELECTOR)) return false;

  const isYouTubePlayer =
    video.matches('.html5-main-video') ||
    Boolean(video.closest('#movie_player, .html5-video-player, ytd-player'));

  return (
    isYouTubePlayer &&
    (isYouTubePlaybackPage() || isYouTubeMiniPlayer(video))
  );
}

function shouldAutoActivateVideo(video: HTMLVideoElement): boolean {
  if (!canControlVideo(video) || video.paused || video.ended) return false;
  if (isYouTubeSite()) return isMeaningfullyVisible(video);

  return video.controls || (!video.muted && video.volume > 0);
}

function shouldActivateOnDiscovery(video: HTMLVideoElement): boolean {
  if (!canControlVideo(video)) return false;
  if (isYouTubeSite()) return isMeaningfullyVisible(video);

  const rect = video.getBoundingClientRect();
  const isLargeEnough = rect.width >= 320 && rect.height >= 180;
  const usesKnownPlayer =
    video.matches(KNOWN_PLAYER_VIDEO_SELECTOR) ||
    Boolean(video.closest(KNOWN_PLAYER_SELECTOR));

  return isLargeEnough && usesKnownPlayer;
}

function isMeaningfullyVisible(video: HTMLVideoElement): boolean {
  const rect = video.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 68) return false;

  const visibleWidth = Math.max(
    0,
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
  );
  const visibleHeight = Math.max(
    0,
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
  );
  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = rect.width * rect.height;

  return visibleArea >= Math.min(totalArea * 0.5, 80_000);
}

function formatSpeed(speed: number): string {
  return speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
