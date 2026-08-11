# Task 4 report — failure-safe dedicated model dispatch

## RED evidence

- Fresh controller run of `tests/equipment-dispatch-3d-runner.html` completed with four intended failures before production edits: `tryBuildDedicatedEquipmentModel` was absent, and dedicated/failure host diagnostics were undefined.
- The focused follow-up RED completed with two failures: the renderer hid the X16 builder fallback warning behind an earlier room warning, and a `null` result for a dedicated profile did not increment builder failures.

## GREEN evidence

- Fresh controller run: `http://127.0.0.1:4173/tests/equipment-dispatch-3d-runner.html?task4-green-3=1` reported `data-complete=true`, `data-failures=0`, `All tests passed.`, and no console warnings/errors.
- The real-Three fixture covers known and unknown dispatch, throwing-stage click-target and disposable cleanup, all eleven successful dedicated models, a throwing X16 that continues as its generic treadmill model, registry restoration in `finally`, a null dedicated-builder fallback, and an unrelated standard fallback.
- Local checks completed without errors: `node --check app.js`, `node --check equipment-models.js`, `node --check view3d.js`, `node --check tests/equipment-profiles.test.js`, `node --check tests/equipment-dispatch-3d-runner.js`, `node --check tests/equipment-dispatch-3d.test.js`, and `git diff --check`.

## Implementation

- Added `tryBuildDedicatedEquipmentModel()` to stage all eleven dedicated builds before attaching them. RX3, Maxwell, and Gazelle retain their existing builders; registry keys go through `GymEquipmentModels`.
- A missing or throwing staged build removes staged click targets, disposes staged geometry/materials/textures, removes disposable references, and then continues to the existing generic family branch. Recursive RX3, Maxwell, and Gazelle calls were removed from generic branches.
- Placement groups now publish `modelProfile`, `modelBuilder`, `dedicatedModel`, `canonicalFootprint`, `worldFootprint`, and `measuredFootprint`. Hosts publish sorted dedicated profile/builder lists plus successful-dedicated and builder-failure counts.
- Dedicated successes keep the shared selected-instance marker. Placement hitboxes, custom-GLB fallback visibility, measured footprint handling, and saved transforms remain in their existing paths.
- A failed dedicated profile emits one measured-fallback warning. These warnings are ordered first so the displayed warning is actionable while the total warning count still includes ordinary room warnings.

## Self-review

- The dispatcher only attaches a staged root after a builder returns successfully; failures leave no detached click target or renderer disposable behind.
- Dedicated counts increment only on successful builds. Missing/throwing dedicated profiles increment failures once; unrelated standard fallback profiles remain clear.
- Generic family geometry stays callable for every dispatcher failure, including the deliberate X16 error, and the exact builders cannot be invoked again from generic branches.
- The real-Three fixture builds all eleven profiles with their measured dimensions and exercises the original registry restoration in `finally`, preventing cross-test state contamination.
