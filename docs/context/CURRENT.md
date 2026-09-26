# Current repository state

Last updated: 2026-09-26

- **Branch:** `main` tracking `origin/main`.
- **Active task:** [#21 — Fix video playback speed reset when toggling fullscreen on YouTube](https://github.com/xuanhao1804/brower_extensions/issues/21).
- **Latest completed repository task:** [#20 — Move Speedable badge on Facebook Reels](https://github.com/xuanhao1804/brower_extensions/issues/20), implementation commit `eefa8b7`.
- **Latest product implementation:** Store-ready version `0.1.4` fixes video playback speed resetting on YouTube when toggling fullscreen (or theater mode) by verifying `video.isConnected` before tearing down observed videos in MutationObserver and preserving active playback rate on activation.
- **Uncommitted task work:** Implementation changes in `VIDEO_SPEED_CONTROLLER/entrypoints/content.ts` and version bump `0.1.4` in `package.json`.
- **User-owned ignored files:** root `skills-lock.json` is intentionally ignored as local skills tooling state.
- **Unpushed task work:** None currently.
- **GitHub synchronization:** Issue #21 opened; Issue #19 remains tracked for Store verification.
- **Open historical work:** [#11 — Create Chrome Web Store promotional tiles](https://github.com/xuanhao1804/brower_extensions/issues/11).
- **Known product problems:** No confirmed product-code regression. Promotional assets are unfinished, and Edge Add-ons search discoverability remains unverified.
- **Blockers:** Developer Dashboard in the available browser session requires Google sign-in.
- **Verification baseline:** On 2026-09-26, `npm run check`, `npm run build` (Chrome MV3), `npm run build:firefox` (Firefox MV2), and `npm run zip` passed for `0.1.4`. Chrome DevTools Protocol automation verified on YouTube that entering and exiting fullscreen preserves custom playback speeds (1.75x -> fullscreen -> 2.25x -> exit fullscreen) without reverting to 1x.
- **Next recommended action:** Commit and push fix for #21, then comment outcome and close #21. Upload `.output/speedable-0.1.4-chrome.zip` to Chrome Web Store.
