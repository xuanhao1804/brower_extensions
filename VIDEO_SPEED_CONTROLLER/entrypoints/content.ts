import {
  clampSpeed,
  matchesShortcut,
  normalizeSpeed,
  sanitizeSettings,
  settingsStorage,
} from '../shared/settings';
import type { ContentMessage, VideoSpeedResponse } from '../shared/messages';

const CONTROLLER_ATTRIBUTE = 'data-vsc-controlled';

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

    function cyclePreset(video: HTMLVideoElement): void {
      const next = settings.presets.find(
        (preset) => preset > video.playbackRate + 0.001,
      );
      setSpeed(video, next ?? settings.presets[0] ?? settings.defaultSpeed);
    }

    function updateBadge(controller?: VideoController): void {
      if (!controller) return;
      controller.badge.textContent = `${formatSpeed(controller.video.playbackRate)}×`;
      controller.host.style.opacity = String(settings.badgeOpacity);
      controller.host.style.display = settings.showBadge ? 'block' : 'none';
      controller.badge.title =
        'Click: tốc độ tiếp theo · Chuột phải: về 1× · Lăn chuột: tăng/giảm';
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

      const rect = video.getBoundingClientRect();
      const isVisible =
        rect.width >= 120 &&
        rect.height >= 68 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth;

      host.style.visibility = isVisible ? 'visible' : 'hidden';
      host.style.left = `${Math.max(8, rect.left + 10)}px`;
      host.style.top = `${Math.max(8, rect.top + 10)}px`;
    }

    function activateVideo(video: HTMLVideoElement): VideoController | null {
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
      const badge = document.createElement('button');
      badge.type = 'button';
      Object.assign(badge.style, {
        all: 'initial',
        boxSizing: 'border-box',
        display: 'grid',
        placeItems: 'center',
        minWidth: '48px',
        height: '28px',
        padding: '0 8px',
        border: '1px solid rgba(255, 255, 255, 0.28)',
        borderRadius: '7px',
        background: 'rgba(10, 12, 16, 0.88)',
        color: '#ffffff',
        font: '600 13px/1 system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.01em',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.28)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        userSelect: 'none',
      });
      shadow.append(badge);
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
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeVideo = video;
        adjustSpeed(video, event.deltaY < 0 ? 1 : -1);
      };

      video.addEventListener('ratechange', onRateChange);
      badge.addEventListener('click', onClick);
      badge.addEventListener('contextmenu', onContextMenu);
      badge.addEventListener('wheel', onWheel, { passive: false });

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
          badge.removeEventListener('wheel', onWheel);
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
      const onPlaying = () => {
        if (shouldAutoActivateVideo(video)) activateVideo(video);
      };

      video.addEventListener('pointerdown', onPointerDown, true);
      video.addEventListener('playing', onPlaying);
      observedVideos.set(video, {
        cleanup: () => {
          video.removeEventListener('pointerdown', onPointerDown, true);
          video.removeEventListener('playing', onPlaying);
        },
      });

      if (!video.paused && shouldAutoActivateVideo(video)) {
        activateVideo(video);
      }
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
        if (shouldAutoActivateVideo(video)) activateVideo(video);
      }
      scheduleLayout();
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
    ctx.addEventListener(document, 'yt-navigate-finish', reconcileVideos);
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

function isYouTubeSite(): boolean {
  return YOUTUBE_HOST_PATTERN.test(window.location.hostname);
}

function canControlVideo(video: HTMLVideoElement): boolean {
  if (!isYouTubeSite()) return true;
  if (!YOUTUBE_PLAYER_PATH_PATTERN.test(window.location.pathname)) return false;
  if (video.closest(YOUTUBE_PREVIEW_SELECTOR)) return false;

  return (
    video.matches('.html5-main-video') ||
    Boolean(video.closest('#movie_player, .html5-video-player, ytd-player'))
  );
}

function shouldAutoActivateVideo(video: HTMLVideoElement): boolean {
  if (!canControlVideo(video) || video.paused || video.ended) return false;
  if (isYouTubeSite()) return true;

  return video.controls || (!video.muted && video.volume > 0);
}

function formatSpeed(speed: number): string {
  return speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
