# Current repository state

Last updated: 2026-09-24

- **Branch:** `main` tracking `origin/main`.
- **Active task:** [#19 — Rename extension to Speedable](https://github.com/xuanhao1804/brower_extensions/issues/19) remains open for public Store verification and listing copy update.
- **Latest completed repository task:** [#20 — Move Speedable badge on Facebook Reels](https://github.com/xuanhao1804/brower_extensions/issues/20), implementation commit `eefa8b7`.
- **Latest product implementation:** Facebook Reel pages now anchor the Speedable controller at the rendered video's bottom-right with 18px bottom clearance, and expanded controls grow leftward; other sites retain their existing placement.
- **Uncommitted task work:** None.
- **User-owned ignored files:** root `skills-lock.json` is intentionally ignored as local skills tooling state.
- **Unpushed task work:** None; `.gitignore` was pushed in commit `c843cec`.
- **GitHub synchronization:** Facebook Reel placement fix `eefa8b7` is pushed and #20 is closed. The `Speedable — Video Speed Controller` rename/package commit `50c3d53` is pushed; #19 is reopened for public Store verification. Historical Issues #2–#14 remain available for earlier work.
- **Open historical work:** [#11 — Create Chrome Web Store promotional tiles](https://github.com/xuanhao1804/brower_extensions/issues/11).
- **Known product problems:** No confirmed product-code regression. Promotional assets are unfinished, and Edge Add-ons search discoverability remains unverified. The public [Chrome Web Store listing](https://chromewebstore.google.com/detail/video-speed-pro/dooaphagdbdnpdjfjbmpcmadioagcpnn) is live but still displays `Video Speed Pro` version `0.1.1` and older detailed copy as of 2026-09-23; the user reports uploading `0.1.2`. Its support-site link resolves back to the Chrome Web Store home page rather than a support destination.
- **Blockers:** Developer Dashboard in the available browser session requires Google sign-in, so the current review status and editable listing fields cannot be inspected or updated here.
- **Verification baseline:** On 2026-09-24, `npm run check`, `npm run build` (Chrome MV3), and `npm run build:firefox` (Firefox MV2) passed after the Facebook Reel placement fix. The route/host guard and supplied DOM/screenshot were reviewed; direct unpacked-extension checks on Facebook's dynamic UI remain recommended. The Store-ready version remains `0.1.2`, with unchanged permissions and Firefox ID.
- **Next recommended action:** Check Developer Dashboard review status for uploaded `0.1.2`, update the detailed Store description to use the Speedable brand, change the support URL to `https://github.com/xuanhao1804/brower_extensions/issues`, and verify the public item ID `dooaphagdbdnpdjfjbmpcmadioagcpnn` displays the new name/version after approval. Separately finish promotional assets and verify Edge Add-ons visibility.
