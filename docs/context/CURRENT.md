# Current repository state

Last updated: 2026-10-01

- **Branch:** main tracking origin/main.
- **Task:** #24 — Fix YouTube Shorts speed controls and shortcuts on Edge.
- **Implementation:** Version 0.1.7 retains explicit per-video speed intent on Shorts for steps/presets and restores overwritten rates with at most three retries per request. Matching shortcuts stop subsequent same-window handlers. Automatic activation does not pin rates; controller teardown clears requests.
- **Evidence:** The actual content source in headless Microsoft Edge passes the simulated-page regression; previous source fails the same test. Covered buttons (0.25–2x), presets, increase/decrease/reset shortcuts, editable input, retry termination, watch navigation, and cleanup.
- **Verification:** Typecheck, Chrome/Edge build, Firefox build, ZIP passed. Live YouTube and the user's installed extension remain unverified; the harness simulates YouTube rate resets and WXT storage/runtime.
- **Delivery:** Implementation and verification complete in the focused #24 commit; GitHub Issue records the pushed commit and outcome.
- **Unrelated files:** Pre-existing untracked root manifest.json preserved.
- **Release package:** VIDEO_SPEED_CONTROLLER/.output/speedable-0.1.7-chrome.zip.
- **Next action:** Reload the unpacked extension from .output/chrome-mv3 in Edge, refresh Shorts, and confirm behavior on the affected video. Store installation needs the published 0.1.7 update.
