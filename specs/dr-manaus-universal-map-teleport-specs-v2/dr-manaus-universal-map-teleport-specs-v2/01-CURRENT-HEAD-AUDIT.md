# Current HEAD audit

## Overall

The branch improved after `f5afb4d`, but the commit:

```text
6eaae64 feat: complete cosmic night roadmap (H7-H13)
```

again labels more as complete than runtime behavior supports.

## Good foundations

- Shared city streaming budget through `ManausSubsystem`
- `EarthTransitionController`
- `InterplanetaryController`
- Moon surface/provider
- `SurfaceFrameService`
- `StarSectorProvider`
- `UniverseAddress` and `CosmologicalAddress`
- persistence and scheduler work from earlier commits

## Current user-facing map/teleport

HUD and PowerSystem were not changed by the new cosmic commit.

The current `E` still uses:

```ts
PhysicsWorld.raycast(..., 2500, ...)
```

and still rejects local destinations beyond:

```text
abs(x) > 100000
abs(z) > 100000
```

So the user-facing teleport is still local-only.

## No GitHub CI status on current HEAD

The audited HEAD has no published combined status checks.

Local test claims may be valid, but the next agent must rerun:

```text
npm test
npm run build
npm run test:browser
```

and record actual results.

## Conclusion

Use this v2, not the previous package.

The universal map can use current Moon/system foundations, but cosmic targets must not be treated as verified until the P0 spatial bugs below are fixed.
