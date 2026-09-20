# Project context

Last verified: 2026-09-20

## Purpose and product

This repository currently contains **Video Speed Pro**, a browser extension for controlling HTML5 video playback speed on YouTube and other websites. Users can configure keyboard shortcuts, mouse-wheel behavior, default speed, speed steps, presets, and an on-video controller with fixed 10-second rewind/forward actions.

The GitHub repository is `xuanhao1804/brower_extensions` (the remote name contains the historical `brower` spelling). Product source lives under `VIDEO_SPEED_CONTROLLER/`.

## Stack and runtime

- TypeScript with strict mode and `noUncheckedIndexedAccess`.
- WXT `^0.21.4`; Manifest V3 for Chrome/Edge builds.
- Vanilla HTML/CSS/TypeScript; no React, backend, analytics, or remote code.
- npm with `VIDEO_SPEED_CONTROLLER/package-lock.json`.
- Node.js and npm are required, but an exact Node version is not pinned in the repository.
- Chrome and Microsoft Edge are primary targets; Firefox is a secondary WXT build target.

## Architecture

### Entrypoints

- `VIDEO_SPEED_CONTROLLER/entrypoints/content.ts`: all-frame content script matched on `*://*/*`. Discovers eligible `<video>` elements, selects one active player, applies playback speed and 10-second seeks, handles keyboard/wheel events, and mounts the Shadow DOM on-video controller.
- `VIDEO_SPEED_CONTROLLER/entrypoints/popup/`: compact settings/quick-control popup. It reads and writes settings and sends typed messages to the active tab.
- No background/service worker, options page, backend, or page-world injected script currently exists.

### Shared modules

- `VIDEO_SPEED_CONTROLLER/shared/settings.ts`: typed settings model, defaults, normalization, shortcut utilities, and WXT `storage.defineItem` binding for `sync:videoSpeedSettings`.
- `VIDEO_SPEED_CONTROLLER/shared/messages.ts`: `GET_VIDEO_SPEED` / `SET_VIDEO_SPEED` message union and response type.

### Main data flow

```text
Popup form ──writes──> browser.storage.sync
     │                         │
     └─ tabs.sendMessage ──> Content script ──> active HTMLVideoElement
                               │
                               └─ watches settings and updates Shadow DOM UI
```

The content script uses DOM/event APIs directly; it does not need page-world access for `HTMLVideoElement.playbackRate`.

## Important behavior and invariants

- Maintain at most one active controller per document/frame and clean stale hosts/listeners/observers.
- Do not activate YouTube hover previews or muted preview videos as real players.
- Support dynamic SPA navigation, YouTube mini-player/floating players, large embedded players, and videos added after page load.
- Keep the badge anchored to the rendered media area (not letterbox space) and hide/remove it when the anchor is invalid or off-screen.
- Ignore shortcuts in editable controls.
- Clamp normalized speeds to `0.25`–`16`; sanitize all stored settings.
- Use Shadow DOM for injected control isolation.
- Broad website matching and `allFrames` are intentional product requirements; avoid adding `tabs`, `cookies`, `webRequest`, `scripting`, or other permissions unless a new feature proves they are required.
- Settings are browser-managed sync data and are not transmitted to a developer server.

## Repository structure

- `AGENTS.md`: concise task entry point and continuity workflow.
- `docs/context/`: canonical stable/current/decision/history/session context.
- `docs/context/ENGINEERING.md`: preserved detailed browser-extension engineering guidance.
- `docs/superpowers/specs/`: approved design specifications.
- `.github/ISSUE_TEMPLATE/`: top-level task template.
- `VIDEO_SPEED_CONTROLLER/public/`: SVG source and PNG extension icons.
- `VIDEO_SPEED_CONTROLLER/tests/fixtures/video.html`: manual HTML5 video fixture; no automated test runner is configured.

## Commands

Run from `VIDEO_SPEED_CONTROLLER/`:

| Purpose | Command |
| --- | --- |
| Reproducible install | `npm ci` |
| Development (Chrome) | `npm run dev` |
| Development (Firefox) | `npm run dev:firefox` |
| Typecheck | `npm run check` |
| Build Chrome/Edge | `npm run build` |
| Build Firefox | `npm run build:firefox` |
| Package ZIP | `npm run zip` |
| Lint | Not configured |
| Automated tests | Not configured |

For manual browser testing, load `VIDEO_SPEED_CONTROLLER/.output/chrome-mv3` as an unpacked extension, then reload both the extension and target page after code changes.

## CI/CD and deployment

- No CI workflow is committed.
- No GitHub release or tag exists as of 2026-09-19.
- Deployment is manual: local unpacked builds and external browser Store submission.
- `VIDEO_SPEED_CONTROLLER/PRIVACY.md` is the public privacy policy.

## Known platform constraints

- Browser/system pages and Store pages do not allow ordinary content-script injection.
- Cross-origin iframe restrictions and non-HTML5/canvas/protected players may limit support.
- Browser/OS-reserved shortcuts and fullscreen behavior can differ.
- Safari and mobile browsers require separate implementation/testing and are not current targets.
