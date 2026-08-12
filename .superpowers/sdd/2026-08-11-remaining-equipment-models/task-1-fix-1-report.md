# Task 1 fix round 1 report — canonical equipment matches

Commit: final task commit (reported with verification evidence in the task handoff)

## Scope

Resolved the Task 1 review finding that clone/reseller brands and accessory/alternate product names could select a dedicated photo-matched profile through substring regular expressions.

## TDD evidence

### RED

- Fresh browser runner: `http://127.0.0.1:4173/tests/planner-logic-runner.html?equipment-canonical-red-1`
- Result: `complete=true`, `failures=2`.
- The new Ice Barrel clone control failed with `Expected "step-in-plunge", received "ice-barrel-500"`, directly proving the substring-match defect before production edits.
- The punctuation-variant control initially exposed the existing narrow row-family recognition; the minimal family expression was then widened to accept slash/dash spacing before the exact profile passes its existing family guard.

### GREEN

- Fresh logic runner: `?equipment-canonical-green-2` → `All tests passed.` with zero warnings/errors.
- Fresh runtime-cache runner: `?equipment-canonical-green-1` → `All tests passed.` The hidden iframe logged the known environment-only `MutationObserver.observe` type error; the normal application page remained clean.
- Fresh normal application page: `index.html?equipment-canonical-console-1` reached `ready=complete`, found `#app`, and had no console warnings or errors.

## Changes

- `app.js` now canonicalizes brand and product separately (case, Unicode dashes, punctuation, ampersand/`and`, slashes, hyphens, and whitespace) and requires exact canonical whole-value equality for all eight automatic dedicated routes.
- Existing broad fallback rules and the Wanjia 4.99 × 2.38 × 4.61-ft dimension gate remain after the exact comparisons.
- Added each route's clone/reseller-brand and accessory/alternate-name controls, asserting its legacy fallback profile and no photo-matched label. Added punctuation-variant coverage for saved legal suffix, dash/slash, ampersand/`and`, and hyphen forms.
- Advanced the changed `app.js`, logic-test, runtime-cache-test, runtime parent, and index cache queries as one chain.

## Final checks

- `node --check app.js`
- `node --check equipment-models.js`
- `node --check tests/equipment-profiles.test.js`
- `node --check tests/runtime-cache.test.js`
- `node --input-type=module --check < gltf-runtime.js`
- `git diff --check`

All commands completed successfully.

## Self-review

- Extra words are never removed during canonicalization, so clones, resellers, accessories, and alternate models cannot qualify as the saved product.
- Legal punctuation variants resolve to the same canonical value, including `&` versus `and`, slashes/dashes, and company suffix punctuation.
- Manual same-family overrides and broad generic profile fallback behavior remain unchanged.
