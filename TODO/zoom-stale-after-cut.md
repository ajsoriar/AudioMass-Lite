# Zoom goes stale after a large Cut

Cut a big chunk out of a file and the view is left absurdly zoomed in, the same
way Trim used to be. Two pieces of viewport state do not survive a change in
buffer length:

- `ZoomFactor` is relative (1 = whole file), and `VisibleDuration` is
  `duration / ZoomFactor`, so a shorter buffer means a proportionally shorter
  window at the same factor. Cut 59s out of 60s at 20x and you are looking at
  50ms.
- `LeftProgress` is an absolute offset in seconds, so it can end up past the end
  of the shortened file.

Trim already handles this, in the `RequestActionTrim` handler in `engine.js`:
it resets `ZoomFactor` to 1 and `LeftProgress` to 0, because after a trim the
file *is* the selection and you want to see it whole.

**Cut needs the opposite treatment.** There you want to keep looking at roughly
where you were, so the fix is to clamp rather than reset: cap `ZoomFactor` at
what the new duration can support and pull `LeftProgress` back into range.
`zoomAt` in `engine.js` already does that clamping and is the shape to copy.

Worth checking whether Paste and the effects that change length need the same
guard, and whether it belongs in one place hanging off `DidUpdateLen` rather
than in each handler.
