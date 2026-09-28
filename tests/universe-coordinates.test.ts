import test from 'node:test';
import assert from 'node:assert/strict';
import { UniverseCoordinates } from '../src/world/spatial/UniverseCoordinates';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import type { TeleportTarget } from '../src/world/spatial/UniverseLocation';

test('UniverseCoordinates formats and parses surface target with full hierarchical context', () => {
  const target: TeleportTarget = {
    kind: 'surface-geodetic',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'earth',
    latDeg: -3.131633,
    lonDeg: -60.024268,
    altitudeM: 85.5,
  };

  const uri = UniverseCoordinates.format(target);
  assert.ok(uri.startsWith('drm:v1://?kind=surface'));
  assert.ok(uri.includes('gal=milky_way'));
  assert.ok(uri.includes('sys=sol'));
  assert.ok(uri.includes('body=earth'));

  const parsed = UniverseCoordinates.parse(uri);
  assert.ok(parsed);
  assert.equal(parsed.kind, 'surface-geodetic');
  if (parsed.kind === 'surface-geodetic') {
    assert.equal(parsed.galaxyId, 'milky_way');
    assert.equal(parsed.systemId, 'sol');
    assert.equal(parsed.bodyId, 'earth');
    assert.ok(Math.abs(parsed.latDeg - (-3.131633)) < 1e-4);
    assert.ok(Math.abs(parsed.lonDeg - (-60.024268)) < 1e-4);
    assert.ok(Math.abs(parsed.altitudeM - 85.5) < 0.2);
  }
});

test('UniverseCoordinates rejects invalid and out-of-bounds geodetic input', () => {
  // Latitude out of [-90, 90]
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&body=earth&lat=95&lon=0&alt=10'), null);
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&body=earth&lat=-91&lon=0&alt=10'), null);

  // NaN or malformed
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&body=earth&lat=NaN&lon=0&alt=10'), null);
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&body=earth&lat=abc&lon=0&alt=10'), null);
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&body=earth&lat=0&lon=xyz&alt=10'), null);
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&body=earth&lat=0&lon=0&alt=null'), null);

  // Longitude out of [-360, 360]
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&body=earth&lat=0&lon=400&alt=10'), null);

  // Missing body
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=surface&lat=0&lon=0&alt=10'), null);
});

test('UniverseCoordinates formats and parses body orbit with context', () => {
  const target: TeleportTarget = {
    kind: 'body-orbit',
    galaxyId: 'milky_way',
    systemId: 'sol',
    bodyId: 'mars',
    altitudeM: 250_000,
  };

  const uri = UniverseCoordinates.format(target);
  assert.ok(uri.includes('kind=orbit'));
  assert.ok(uri.includes('body=mars'));
  assert.ok(uri.includes('alt=250000.0'));

  const parsed = UniverseCoordinates.parse(uri);
  assert.ok(parsed && parsed.kind === 'body-orbit');
  if (parsed && parsed.kind === 'body-orbit') {
    assert.equal(parsed.galaxyId, 'milky_way');
    assert.equal(parsed.systemId, 'sol');
    assert.equal(parsed.bodyId, 'mars');
    assert.equal(parsed.altitudeM, 250_000);
  }

  // Negative altitude orbit must be rejected
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=orbit&body=mars&alt=-100'), null);
});

test('UniverseCoordinates formats and parses system position', () => {
  const target: TeleportTarget = {
    kind: 'system-position',
    galaxyId: 'milky_way',
    systemId: 'sol',
    positionM: [1.496e11, 0, 5.0e10],
  };

  const uri = UniverseCoordinates.format(target);
  const parsed = UniverseCoordinates.parse(uri);
  assert.ok(parsed && parsed.kind === 'system-position');
  if (parsed && parsed.kind === 'system-position') {
    assert.equal(parsed.galaxyId, 'milky_way');
    assert.equal(parsed.systemId, 'sol');
    assert.ok(Math.abs(parsed.positionM[0] - 1.496e11) < 1);
    assert.ok(Math.abs(parsed.positionM[2] - 5.0e10) < 1);
  }

  // Non-finite coordinates must be rejected
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=system&sys=sol&x=Infinity&y=0&z=0'), null);
});

test('UniverseCoordinates preserves BigInt sector coordinates exactly', () => {
  const bigSector = sectorIndex(9007199254740995n, -1234567890123456789n, 42n);
  const target: TeleportTarget = {
    kind: 'cosmic-sector',
    galaxyId: 'andromeda',
    sector: bigSector,
    offsetM: [100.5, 200.5, 300.5],
  };

  const uri = UniverseCoordinates.format(target);
  const parsed = UniverseCoordinates.parse(uri);
  assert.ok(parsed && parsed.kind === 'cosmic-sector');
  if (parsed && parsed.kind === 'cosmic-sector') {
    assert.equal(parsed.galaxyId, 'andromeda');
    assert.equal(parsed.sector.x, 9007199254740995n);
    assert.equal(parsed.sector.y, -1234567890123456789n);
    assert.equal(parsed.sector.z, 42n);
    assert.equal(parsed.offsetM[0], 100.5);
  }

  // Malformed BigInt
  assert.equal(UniverseCoordinates.parse('drm:v1://?kind=sector&gal=milky_way&sx=abc&sy=0&sz=0&ox=0&oy=0&oz=0'), null);
});

test('UniverseCoordinates formats and parses cosmological target', () => {
  const target: TeleportTarget = {
    kind: 'cosmological',
    address: {
      cell: { x: 10n, y: -20n, z: 30n },
      localMpc: [1.5, 2.5, 3.5],
      epoch: 13.8,
      redshift: 0.05,
      comovingDistanceM: 6.5e24,
    },
  };

  const uri = UniverseCoordinates.format(target);
  const parsed = UniverseCoordinates.parse(uri);
  assert.ok(parsed && parsed.kind === 'cosmological');
  if (parsed && parsed.kind === 'cosmological') {
    assert.equal(parsed.address.cell.x, 10n);
    assert.equal(parsed.address.cell.y, -20n);
    assert.ok(Math.abs(parsed.address.localMpc[0] - 1.5) < 1e-3);
    assert.ok(Math.abs(parsed.address.redshift! - 0.05) < 1e-4);
  }
});

test('UniverseCoordinates rejects completely foreign strings', () => {
  assert.equal(UniverseCoordinates.parse(''), null);
  assert.equal(UniverseCoordinates.parse('https://example.com'), null);
  assert.equal(UniverseCoordinates.parse('drm:v2://?kind=surface'), null);
  assert.equal(UniverseCoordinates.parse('invalid protocol'), null);
});
