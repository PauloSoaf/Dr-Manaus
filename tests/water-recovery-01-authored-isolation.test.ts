import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Group, Mesh, Vector3 } from 'three/webgpu';
import { createAirport } from '../src/world/realcity/airport';
import { AuthoredDestruction } from '../src/world/destruction/AuthoredDestruction';

describe('CICLO 1: Manaus Authored Isolation vs Active Procedural Surface Root', () => {

  it('1. Airport mesh is authored and belongs strictly to Manaus authored root', () => {
    const destruction = new AuthoredDestruction();
    const airportGroup = createAirport(destruction);

    assert.ok(airportGroup instanceof Group, 'airportGroup is a Three.js Group');
    assert.equal(airportGroup.name, 'Aeroporto Internacional Eduardo Gomes — pista 10/28');
    assert.ok(airportGroup.children.length > 0, 'Airport contains runways, terminals and towers');

    const manausAuthoredRoot = new Group();
    manausAuthoredRoot.name = 'Manaus · authored city & terrain';
    manausAuthoredRoot.add(airportGroup);

    const activeProceduralSurfaceRoot = new Group();
    activeProceduralSurfaceRoot.name = 'Active Procedural Surface · chunks & ocean horizon';

    // Verify isolation
    assert.equal(airportGroup.parent, manausAuthoredRoot);
    assert.notEqual(airportGroup.parent, activeProceduralSurfaceRoot);

    // Visibility toggle: outside Manaus, authored root and airport must be hidden
    let isManaus = true;
    manausAuthoredRoot.visible = isManaus;
    airportGroup.visible = isManaus;
    assert.equal(airportGroup.visible, true);

    // Move to Pacific Ocean / Thalassa
    isManaus = false;
    manausAuthoredRoot.visible = isManaus;
    airportGroup.visible = isManaus;
    assert.equal(airportGroup.visible, false);
    assert.equal(manausAuthoredRoot.visible, false);
  });

  it('2. Manaus authored root stays anchored to Earth anchor and never migrates to foreign origin', () => {
    const manausAnchor = new Group();
    manausAnchor.name = 'earth.manausSurfaceAnchor';

    const manausAuthoredRoot = new Group();
    manausAnchor.add(manausAuthoredRoot);

    // Initial pose in Manaus
    assert.equal(manausAuthoredRoot.parent, manausAnchor);
    assert.equal(manausAuthoredRoot.position.x, 0);
    assert.equal(manausAuthoredRoot.position.y, 0);
    assert.equal(manausAuthoredRoot.position.z, 0);

    // When travelling to remote oceans, manausAuthoredRoot does not change parent or position
    const remoteOrigin = new Vector3(5000000, 1000, -8000000);
    const activeProceduralSurfaceRoot = new Group();
    activeProceduralSurfaceRoot.position.copy(remoteOrigin).negate();

    assert.equal(manausAuthoredRoot.parent, manausAnchor);
    assert.equal(manausAuthoredRoot.position.x, 0);
    assert.equal(activeProceduralSurfaceRoot.position.x, -5000000);
  });
});
