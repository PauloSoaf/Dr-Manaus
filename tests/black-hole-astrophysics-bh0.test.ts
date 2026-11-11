import test from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three/webgpu';
import {
  GRAVITATIONAL_CONSTANT,
  SPEED_OF_LIGHT,
  SOLAR_MASS_KG,
  schwarzschildRadiusM,
  kerrHorizonRadiusM,
  photonSphereRadiusM,
  iscoRadiusM,
  blackHoleShadowRadiusM,
  eddingtonLuminosityW,
  SAGITTARIUS_A_STAR,
  M31_CENTRAL_BLACK_HOLE,
  CANONICAL_BLACK_HOLES,
  getCanonicalBlackHole,
  generateStellarBlackHole,
  createBlackHoleDescriptor,
} from '../src/world/celestial/BlackHoleDescriptor';
import { UniversalTargetCatalog } from '../src/world/travel/UniversalTargetCatalog';
import { universalTargetKey, createUniversalTarget } from '../src/world/travel/UniversalNavigationTarget';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { isCanonicalTarget } from '../src/world/exploration/CosmicAtlasModel';
import { BlackHoleProvider } from '../src/world/providers/BlackHoleProvider';
import { renderUniversalTargetCardHtml } from '../src/ui/map/UniversalMapPanel';

test('T_BH0_01_PHYSICAL_FORMULAS_AND_CONSTANTS', () => {
  // 1. Schwarzschild radius for 1 Solar Mass: r_s = 2GM/c^2 ~= 2953.36 m
  const rsSun = schwarzschildRadiusM(SOLAR_MASS_KG);
  assert.ok(Math.abs(rsSun - 2953.36) < 1.0, `rsSun should be ~2953.36 m, got ${rsSun}`);

  // Zero / negative mass boundary
  assert.equal(schwarzschildRadiusM(0), 0);
  assert.equal(schwarzschildRadiusM(-100), 0);

  // 2. Kerr event horizon for a* = 0 must match Schwarzschild radius
  const rHorizonNonRotating = kerrHorizonRadiusM(SOLAR_MASS_KG, 0);
  assert.ok(Math.abs(rHorizonNonRotating - rsSun) < 1e-3, 'Kerr horizon for a*=0 must equal Schwarzschild radius');

  // Kerr horizon for maximal spin (a* -> 0.998) contracts to ~0.53 * r_s
  const rHorizonMaximal = kerrHorizonRadiusM(SOLAR_MASS_KG, 0.998);
  assert.ok(rHorizonMaximal < rsSun, 'Spinning black hole horizon must be smaller than Schwarzschild');
  assert.ok(rHorizonMaximal > rsSun * 0.5, 'Kerr horizon must stay above GM/c^2 (half r_s)');

  // 3. Photon sphere radius for Schwarzschild (a* = 0) must equal 1.5 * r_s
  const rPhotonNonRotating = photonSphereRadiusM(SOLAR_MASS_KG, 0);
  assert.ok(Math.abs(rPhotonNonRotating - 1.5 * rsSun) < 1e-2, `Photon sphere for a*=0 must be 1.5*rs, got ${rPhotonNonRotating}`);

  // 4. ISCO for Schwarzschild (a* = 0) must equal 3.0 * r_s (6 GM/c^2)
  const rIscoNonRotating = iscoRadiusM(SOLAR_MASS_KG, 0);
  assert.ok(Math.abs(rIscoNonRotating - 3.0 * rsSun) < 1e-2, `ISCO for a*=0 must be 3*rs, got ${rIscoNonRotating}`);

  // ISCO for prograde rotating black hole (a* = 0.9) must be substantially smaller than 3 * r_s
  const rIscoRotating = iscoRadiusM(SOLAR_MASS_KG, 0.9);
  assert.ok(rIscoRotating < rIscoNonRotating, 'Prograde spin must bring ISCO closer to horizon');
  assert.ok(rIscoRotating > kerrHorizonRadiusM(SOLAR_MASS_KG, 0.9), 'ISCO must remain outside the Kerr horizon');

  // 5. Apparent shadow radius under gravitational lensing: R_shadow = (sqrt(27)/2) * r_s ~= 2.598 * r_s
  const rShadow = blackHoleShadowRadiusM(SOLAR_MASS_KG, 0);
  const expectedShadow = (Math.sqrt(27) / 2) * rsSun;
  assert.ok(Math.abs(rShadow - expectedShadow) < 1e-2, `Shadow radius should be ~2.598 * rs, got ${rShadow}`);

  // 6. Eddington luminosity: ~1.26e31 W for 1 Solar Mass
  const lEddSun = eddingtonLuminosityW(SOLAR_MASS_KG);
  assert.ok(Math.abs(lEddSun - 1.26e31) < 1e29, 'Eddington luminosity for 1 Solar Mass should be ~1.26e31 W');
});

test('T_BH0_02_SAGITTARIUS_A_STAR_PROFILE', () => {
  const sgra = SAGITTARIUS_A_STAR;
  assert.equal(sgra.id, 'sgra');
  assert.equal(sgra.name, 'Sagittarius A*');
  assert.equal(sgra.galaxyId, 'milky_way');
  assert.equal(sgra.isCanonical, true);

  // Mass ~= 4.297 million solar masses
  assert.ok(Math.abs(sgra.massSolar - 4.297e6) < 1e3);

  // Schwarzschild radius should be ~1.269e10 m (~0.0848 AU)
  assert.ok(sgra.schwarzschildRadiusM > 1.2e10 && sgra.schwarzschildRadiusM < 1.3e10);

  // Apparent shadow should be enlarged by gravitational lensing
  assert.ok(sgra.shadowRadiusM > sgra.schwarzschildRadiusM * 2.0);

  // Spin a* = 0.90
  assert.equal(sgra.spin01, 0.90);

  // Accretion disk present and physically ordered
  assert.ok(sgra.accretion, 'Sagittarius A* must have accretion profile');
  assert.ok(sgra.accretion!.innerRadiusM >= sgra.eventHorizonRadiusM, 'Inner accretion radius must be at or outside horizon');
  assert.ok(sgra.accretion!.outerRadiusM > sgra.accretion!.innerRadiusM, 'Outer disk radius must exceed inner radius');
  assert.ok(sgra.accretion!.peakTemperatureK >= 1e6, 'Accretion gas must exceed 1 million Kelvin');
});

test('T_BH0_03_ANDROMEDA_M31_SMBH_PROFILE', () => {
  const m31 = M31_CENTRAL_BLACK_HOLE;
  assert.equal(m31.id, 'm31_smbh');
  assert.equal(m31.galaxyId, 'andromeda');
  assert.equal(m31.isCanonical, true);

  // Mass ~= 1.4e8 solar masses (~30x larger than Sgr A*)
  assert.ok(Math.abs(m31.massSolar - 1.4e8) < 1e5);
  assert.ok(m31.massKg > SAGITTARIUS_A_STAR.massKg * 25);

  // Schwarzschild radius should be ~4.13e11 m (~2.76 AU)
  assert.ok(m31.schwarzschildRadiusM > 4.0e11 && m31.schwarzschildRadiusM < 4.3e11);

  // Accretion disk parameters
  assert.ok(m31.accretion);
  assert.ok(m31.accretion!.luminosityW > SAGITTARIUS_A_STAR.accretion!.luminosityW);

  // Registry lookup
  assert.equal(getCanonicalBlackHole('sgra'), SAGITTARIUS_A_STAR);
  assert.equal(getCanonicalBlackHole('m31_smbh'), M31_CENTRAL_BLACK_HOLE);
  assert.equal(getCanonicalBlackHole('nonexistent'), undefined);
});

test('T_BH0_04_PROCEDURAL_STELLAR_BLACK_HOLE_GENERATOR', () => {
  // 1. Scan sectors to locate a deterministic stellar black hole
  let foundSector: { x: bigint; y: bigint; z: bigint } | undefined;
  let foundBH = undefined;

  for (let x = 0n; x < 200n; x++) {
    const sec = sectorIndex(x, 12n, -5n);
    const candidate = generateStellarBlackHole('milky_way', sec);
    if (candidate) {
      foundSector = sec;
      foundBH = candidate;
      break;
    }
  }

  assert.ok(foundSector && foundBH, 'Must find a procedural stellar black hole in galactic sector survey');

  // 2. Determinism: regenerating same sector returns mathematically identical descriptor
  const regenerated = generateStellarBlackHole('milky_way', foundSector!)!;
  assert.equal(regenerated.id, foundBH.id);
  assert.equal(regenerated.massKg, foundBH.massKg);
  assert.equal(regenerated.spin01, foundBH.spin01);
  assert.equal(regenerated.schwarzschildRadiusM, foundBH.schwarzschildRadiusM);
  assert.equal(regenerated.shadowRadiusM, foundBH.shadowRadiusM);
  assert.deepEqual(regenerated.positionM, foundBH.positionM);

  // 3. Physical boundaries for stellar black holes:
  // Mass in 5 to 35 Solar Masses
  assert.ok(foundBH.massSolar >= 5.0 && foundBH.massSolar <= 35.0, `Stellar BH mass must be 5-35 Msun, got ${foundBH.massSolar}`);
  // Schwarzschild radius in ~15 km to ~105 km
  assert.ok(foundBH.schwarzschildRadiusM >= 14_000 && foundBH.schwarzschildRadiusM <= 110_000);
  // Spin parameter in [0, 0.998]
  assert.ok(foundBH.spin01 >= 0 && foundBH.spin01 <= 0.998);
  // Accretion disk temperature is high (X-ray emitter)
  assert.ok(foundBH.accretion!.peakTemperatureK >= 5e6);
});

test('T_BH0_05_UNIVERSAL_TARGET_CATALOG_BLACK_HOLE_RESOLUTION', () => {
  const catalog = new UniversalTargetCatalog();

  // 1. Resolve canonical Sgr A*
  const sgra = catalog.find('sgra');
  assert.ok(sgra, 'Catalog must find sgra');
  assert.equal(sgra.kind, 'black-hole');
  assert.equal(sgra.displayName, 'Sagittarius A*');
  assert.equal(sgra.galaxyId, 'milky_way');

  // 2. Resolve canonical M31 SMBH
  const m31 = catalog.find('m31_smbh');
  assert.ok(m31, 'Catalog must find m31_smbh');
  assert.equal(m31.kind, 'black-hole');
  assert.equal(m31.galaxyId, 'andromeda');

  // 3. Resolve by full universal key
  const keySgra = universalTargetKey(sgra);
  assert.ok(keySgra.includes('black-hole/sgra'));
  const resolvedByKey = catalog.find(keySgra);
  assert.ok(resolvedByKey);
  assert.equal(resolvedByKey.objectId, 'sgra');

  // 4. Resolve procedural black hole key
  const sector = sectorIndex(15n, 12n, -5n);
  const sbh = generateStellarBlackHole('milky_way', sector);
  if (sbh) {
    const sbhTarget = createUniversalTarget({
      kind: 'black-hole',
      displayName: sbh.name,
      objectId: sbh.id,
      galaxyId: 'milky_way',
      address: { galaxyId: 'milky_way', sector },
    });
    const sbhKey = universalTargetKey(sbhTarget);
    const resolvedSbh = catalog.find(sbhKey);
    assert.ok(resolvedSbh, 'Catalog must resolve procedural stellar black hole universal key');
    assert.equal(resolvedSbh.objectId, sbh.id);
  }
});

test('T_BH0_06_TAXONOMY_AND_CANONICITY', () => {
  const catalog = new UniversalTargetCatalog();
  const sgra = catalog.find('sgra')!;
  const m31 = catalog.find('m31_smbh')!;

  // 1. Canonical black holes are classified as canonical
  assert.equal(isCanonicalTarget(sgra), true, 'Sagittarius A* must be canonical target');
  assert.equal(isCanonicalTarget(m31), true, 'M31 SMBH must be canonical target');

  // 2. Procedural stellar black holes are classified as procedural
  const sector = sectorIndex(99n, 0n, 0n);
  const fakeSbh = createUniversalTarget({
    kind: 'black-hole',
    displayName: 'Stellar Black Hole 99,0,0',
    objectId: 'sbh_milky_way_99_0_0',
    galaxyId: 'milky_way',
    address: { galaxyId: 'milky_way', sector },
  });
  assert.equal(isCanonicalTarget(fakeSbh), false, 'Procedural black hole must not be canonical target');
});

test('T_BH0_07_BLACK_HOLE_PROVIDER_LOD_AND_SCALE', () => {
  const parent = new Group();
  const provider = new BlackHoleProvider(parent, {
    blackHole: SAGITTARIUS_A_STAR,
    galaxyId: 'milky_way',
  });

  assert.equal(provider.id, 'blackhole/sgra');
  assert.ok(provider.group);
  assert.ok(provider.group.children.length >= 2, 'Provider group must contain event horizon and accretion disk');

  // Event horizon mesh verification
  const horizonMesh = provider.group.children[0] as any;
  assert.ok(horizonMesh);
  assert.ok(horizonMesh.geometry);
  assert.ok(horizonMesh.material);

  // Accretion disk mesh verification
  const diskMesh = provider.group.children[1] as any;
  assert.ok(diskMesh);
  assert.ok(diskMesh.geometry);

  // Update check
  provider.update({ galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n) }, [0, 0, 0], 5000);
  assert.equal(provider.stats.visible, true);

  // Dispose cleanup
  provider.dispose();
  assert.equal(provider.group.parent, null, 'Dispose must detach group from parent');
});

test('T_BH0_08_TARGET_CARD_ASTROPHYSICS_AND_LANDING_HTML', () => {
  const catalog = new UniversalTargetCatalog();
  const sgraDesc = catalog.find('sgra')!;
  const sgraTarget = createUniversalTarget(sgraDesc);
  const resolved = {
    target: sgraTarget,
    valid: true,
    materialized: true,
    domain: 'galaxy' as const,
    travelCapability: 'hypercruise-only' as const,
  };

  const html = renderUniversalTargetCardHtml(resolved, undefined, 'milky_way', false, false, catalog);

  // 1. Classification
  assert.ok(html.includes('Buraco Negro Supermassivo Canônico'), 'Target card must display canonical SMBH classification');

  // 2. Dedicated Section
  assert.ok(html.includes('ASTROFÍSICA &amp; HORIZONTE DE EVENTOS'), 'Card must render astrophysics & event horizon section');

  // 3. Relativistic metric parameters
  assert.ok(html.includes('Raio Schwarzschild'), 'Card must show Schwarzschild radius');
  assert.ok(html.includes('Horizonte de Kerr'), 'Card must show Kerr horizon');
  assert.ok(html.includes('Sombra Lenteada'), 'Card must show lensed shadow radius');
  assert.ok(html.includes('Spin Kerr'), 'Card must show spin parameter');

  // 4. Non-landable singularity condition
  assert.ok(html.includes('✗ Pouso impossível (singularidade relativística)'), 'Must indicate impossible landing at singularity');
  assert.ok(html.includes('Disco de Acreção'), 'Must show active accretion disk');
});

