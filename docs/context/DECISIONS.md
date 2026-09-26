# Durable decisions

This is an ADR-lite log. New entries are appended only for decisions expected to constrain future work.

## 2026-09-18 — Use a content-script-first WXT architecture

- **Decision:** Build the MVP with WXT, strict TypeScript, Vanilla UI, one content script, and one popup; do not add React, a background/service worker, page-world injection, or a backend without a concrete requirement.
- **Context:** Playback speed is a DOM `HTMLVideoElement` concern and settings/quick controls are small.
- **Rationale:** This is the smallest architecture that meets the product requirements and avoids unnecessary lifecycle, bundle, and operational complexity.
- **Consequences:** Popup state must live in browser storage; the popup communicates directly with content scripts. Features needing persistent coordination may justify a background entrypoint later.
- **Related Issue:** [#2](https://github.com/xuanhao1804/brower_extensions/issues/2)
- **Related PR:** None.
- **Related commit:** [`de1fde9`](https://github.com/xuanhao1804/brower_extensions/commit/de1fde9117466a1cdf369ea1c587e56beea942ad)

## 2026-09-18 — Store small user settings in browser sync storage

- **Decision:** Keep typed, sanitized preferences in WXT's `sync:videoSpeedSettings`; represent shortcuts with `KeyboardEvent.code` plus modifiers.
- **Context:** Settings are small, non-secret, and should follow users across browser installations when browser sync is enabled.
- **Rationale:** Browser-managed sync storage fits the data and avoids a backend. `code` is more stable than character keys across keyboard layouts.
- **Consequences:** Storage values are not secrets; settings schema/default changes must remain backward-tolerant through sanitization.
- **Related Issue:** [#2](https://github.com/xuanhao1804/brower_extensions/issues/2)
- **Related PR:** None.
- **Related commit:** [`de1fde9`](https://github.com/xuanhao1804/brower_extensions/commit/de1fde9117466a1cdf369ea1c587e56beea942ad)

## 2026-09-18 — Use broad content-script matching for the cross-site product purpose

- **Decision:** Match `*://*/*` and enable `allFrames` so the extension can control HTML5 video across websites and embedded players; keep manifest permissions otherwise minimal (`storage`).
- **Context:** The core promise is not limited to one domain, and many players are embedded in iframes.
- **Rationale:** `activeTab` would require a user click per tab and would break automatic indicator/shortcut behavior. Domain-specific hosts would contradict the cross-site product requirement.
- **Consequences:** Store review may be stricter; the privacy policy and listing must explain local-only processing. Do not expand permissions without feature evidence.
- **Related Issues:** [#2](https://github.com/xuanhao1804/brower_extensions/issues/2), [#13](https://github.com/xuanhao1804/brower_extensions/issues/13)
- **Related PR:** None.
- **Related commit:** [`de1fde9`](https://github.com/xuanhao1804/brower_extensions/commit/de1fde9117466a1cdf369ea1c587e56beea942ad)

## 2026-09-18 — Isolate and lifecycle-manage the on-video controller

- **Decision:** Render the controller in closed Shadow DOM, keep one active controller per document/frame, activate real players through events/heuristics, and explicitly clean stale DOM/listeners/observers during SPA changes.
- **Context:** Websites have conflicting CSS, dynamically replace videos, expose hover previews, and transition through invalid/off-screen layouts.
- **Rationale:** Isolation prevents CSS collisions; event-driven lifecycle handling avoids heavy polling and duplicate overlays.
- **Consequences:** New player integrations must preserve preview filtering, single-controller behavior, anchor validity, and cleanup invariants.
- **Related Issues:** [#3](https://github.com/xuanhao1804/brower_extensions/issues/3), [#4](https://github.com/xuanhao1804/brower_extensions/issues/4), [#5](https://github.com/xuanhao1804/brower_extensions/issues/5), [#6](https://github.com/xuanhao1804/brower_extensions/issues/6), [#7](https://github.com/xuanhao1804/brower_extensions/issues/7)
- **Related PR:** None.
- **Related commits:** `5d6ed31`, `8ed87f1`, `e8edcc4`, `27d9379`, `8ee2896`, `0d5b375`.

## 2026-09-19 — Make repository artifacts the continuity system

- **Decision:** Use `AGENTS.md` as the mandatory entry point, `docs/context/*` as curated context, one GitHub Issue per top-level outcome, Git commits as implementation evidence, and monthly session summaries instead of chat transcripts.
- **Context:** A new Codex task must reconstruct project state without relying on earlier chat history.
- **Rationale:** Repository and GitHub artifacts are durable, reviewable, shareable, and independent of chat retention.
- **Consequences:** Every repository task must read context at start, reuse its Issue for clarifications/follow-ups, update context, verify, commit, push, comment the outcome, and only then close the Issue.
- **Related Issue:** [#1](https://github.com/xuanhao1804/brower_extensions/issues/1)
- **Related PR:** None.
- **Related commit:** [`d15e8c3`](https://github.com/xuanhao1804/brower_extensions/commit/d15e8c3)

## 2026-09-23 — Use Speedable as the public product brand

- **Decision:** Use `Speedable` as the short UI brand and `Speedable — Video Speed Controller` as the manifest and Store-facing title; retain existing extension identifiers and storage keys.
- **Context:** The prior `Video Speed Pro` title collided with an older Store listing and was difficult to distinguish in search.
- **Rationale:** A compact brand improves recognition while the descriptive suffix preserves the primary discovery keyword and clearly states the extension's purpose.
- **Consequences:** Product-facing copy, packages and future Store assets must use the new brand. Renaming must not create a new Store item, Firefox identity or settings namespace.
- **Related Issue:** [#19](https://github.com/xuanhao1804/brower_extensions/issues/19)
- **Related PR:** None.
- **Related commit:** [`50c3d53`](https://github.com/xuanhao1804/brower_extensions/commit/50c3d53)

## 2026-09-26 — Preserve video controllers and playback rate across DOM re-parenting

- **Decision:** In `MutationObserver` removal processing, verify `!video.isConnected` before tearing down an observed video or controller; in `activateVideo`, retain existing `video.playbackRate` when `settings.defaultSpeed` is `1`.
- **Context:** Sites like YouTube move player containers (`#player-container`) between DOM parents when toggling fullscreen or theater mode. MutationObserver batches report these as `removedNodes` followed by `addedNodes`.
- **Rationale:** Tearing down and recreating controllers on re-parented videos caused `video.playbackRate` to be unconditionally reset to `settings.defaultSpeed` (1x). Checking connection prevents destructive lifecycle churning.
- **Consequences:** Video controllers, event listeners, and custom speeds survive fullscreen and view-mode toggles without resetting.
- **Related Issue:** [#21](https://github.com/xuanhao1804/brower_extensions/issues/21)
- **Related PR:** None.
- **Related commit:** [`ee85425`](https://github.com/xuanhao1804/brower_extensions/commit/ee85425)

## 2026-09-26 — Correct expand-left button layout order and track active playback speed

- **Decision:** Use CSS `order` (`order: 1` on `.vsc-speed`, `order: 2` on `.vsc-forward`, `order: 3` on `.vsc-increase`, `order: 4` on `.vsc-decrease`, `order: 5` on `.vsc-rewind`) under `:host([data-vsc-expand-left])` so that inside a `flex-direction: row-reverse` container the visual left-to-right order remains `[ << ] [ − ] [ + ] [ >> ] [ x1 ]`. Track `lastUserSpeed` in `content.ts` and re-apply it on `fullscreenchange` and controller activation to withstand player speed resets on Facebook and YouTube.
- **Context:** Placing the Facebook Reel indicator at the bottom-right and expanding leftwards via `flex-direction: row-reverse` reversed the DOM button order, producing `[ >> ] [ + ] [ − ] [ << ] [ x1 ]`. Additionally, Facebook and other sites re-render or re-initialize player components when entering/exiting fullscreen.
- **Rationale:** CSS `order` controls visual order without changing DOM structure or keyboard navigation semantics. Tracking user-set speed in the session prevents sites' internal player resets from overriding user preference.
- **Consequences:** Layout is consistent whether expanding left or right; fullscreen transitions across YouTube and Facebook maintain selected speed.
- **Related Issue:** [#22](https://github.com/xuanhao1804/brower_extensions/issues/22)
- **Related PR:** None.
- **Related commit:** [`a5e9caf`](https://github.com/xuanhao1804/brower_extensions/commit/a5e9caf)

