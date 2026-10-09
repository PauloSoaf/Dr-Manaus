# Permanent cross-feature regression gate

Mandatory for U3 and every later checkpoint (U4, BH0–BH2, U5, U6):

1. `npm run typecheck`
2. `npm run test:regression`
3. Focused tests for the change
4. `npm run check:impact-fidelity` with the existing tolerances
5. `npm test` and `npm run build`
6. `npm run test:browser:regression`
7. `git diff --check`, then inspect CI for the exact pushed SHA

The unit gate in `tests/regression/` registers the existing runtime contract suites directly.
This keeps the original assertions, test names and fidelity thresholds authoritative instead
of duplicating them in a second implementation. Coverage includes actual Manaus data and water,
forest footprints, aerial curvature and transitions, Solar ephemerides, target lock, Warp/CCD,
Sun photosphere, Moon/Mars landing, D1 volume publication and D1.2 collider fidelity, U0 BigInt
identity, U1 playable generated systems, U2 galaxy ownership/roundtrips and bounded rendering.

`scripts/regression-browser.mjs` runs the existing local Manaus, aerial, Solar/U1 and U2 runners
sequentially, followed by the U3 production runner. Each runner owns and closes its server and
browser, checks page/console errors and writes ignored artifacts. A missing checkpoint fails
the gate. CI runs the unit gate before the full suite and build; native GPU browser validation
is a separate local gate and is never reported as CI coverage.

Do not declare a checkpoint complete while any gate fails. Fix the regression first. Browser
automation complements the user's manual gameplay and visual acceptance; it does not replace it.
