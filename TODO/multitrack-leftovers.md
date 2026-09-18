# Multitrack leftovers

Multitrack was removed on the `lite` branch: `multitrack.js`, `mix.html` and
`amss-format.js` are gone, along with the header button, the View menu entry and
the `?multitrack=1` param. Three things were left behind on purpose.

## Dead guards in JS

~30 branches still read `app.multitrack`, which is now always `null`, so they are
inert. Stripping them is mechanical but touches files of 100 KB+, so it was kept
out of the removal commit to keep that diff reviewable.

`ui.js` (`activeMultitrackFor` and its callers), `ui-fx.js`, `engine.js`,
`state.js`, `markers.js`, `fx-pg-eq.js`, `fx-auto.js`.

Also inert: `app.js` still wires `q.multitrack = q._deps.multitrack ? ... : null`.
Kept as the plugin seam — drop the line if the seam is not wanted.

## about.html

Still documents multitrack: nav link, a full section with screenshots, the
keyboard shortcuts list and a changelog entry. Editorial call — the changelog
entry is history and can stay, the rest describes a feature that no longer ships.

## main.css

`.pk_mt_*` rules are unused: multitrack canvas, the "switch to multitrack" button
and two mobile blocks (larger hit targets, tooltip hiding). Roughly lines 635,
749, 1577 and 1667.
