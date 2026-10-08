# Usability review

## Verified in code and automated checks

- Draft option additions/removals mark unsaved changes, including after a save.
- Draft-load errors offer a retry action; the back link names its actual destination.
- Navigation transfers keyboard focus to the main content and the skip link has a focusable destination.
- Network failures and non-JSON service errors display readable retry guidance without exposing parser errors.
- Mobile CSS gives navigation and action controls at least 44px targets, wraps narrow action rows, keeps form inputs at 16px, and allows long questions and result labels to wrap.
- Existing tests cover vote confirmation, private drafts, results privacy, QR links, presentation updates, archive/restore, and CSV downloads.

## Physical-device checks still pending

Browser automation was unavailable during this review. CSS inspection and DOM tests do not verify actual layout, camera scanning, touch interactions, or native downloads. Check at 320px, 375px, 390px, and tablet widths in portrait and landscape:

1. Sign in and navigate through All polls, Join poll, My drafts, and Create poll. Confirm no horizontal page scroll or overlapping controls.
2. Edit a draft with ten options and long labels. Add/remove options, save, preview, and publish. Ensure the keyboard does not hide the focused field or primary action.
3. Scan a QR code from a second device on the same network. Confirm sign-in returns to the poll and one submission yields one persistent receipt.
4. Check all three visibility modes, including presentation mode and closing at a deadline. Try long Unicode questions and labels.
5. Disconnect the network while loading a draft and submitting a vote. Reconnect, retry loading, and check whether the vote was recorded before submitting again.
6. Archive and restore a closed poll; export a CSV and locate it in the phone's downloads. Check clipboard fallback on a browser that denies clipboard access.
7. Use keyboard-only navigation on desktop: skip link, visible focus, radio choices, preview, and fullscreen exit. Check screen-reader announcements for errors and vote confirmation.

Do not describe these physical-device checks as passed until they have actually been performed.
