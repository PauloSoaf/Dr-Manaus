import test from 'node:test';
import assert from 'node:assert/strict';
import {measureCraterFidelity,craterFidelityAccepted,CRATER_FIDELITY_TOLERANCE} from './helpers/crater-fidelity.ts';

const rows=['moon','mars','earth'].flatMap(body=>[260,800].map(speed=>measureCraterFidelity(body,speed)));
test('T_D11_SMALL_CRATER_RADIUS_ERROR_MEASURED',()=>{
  for(const row of rows) {
    assert.equal(row.measuredOpeningRadiiM.length,8);
    assert.ok(row.measuredOpeningRadiiM.every(r=>Number.isFinite(r)&&r>0));
    assert.ok(row.maxVisualColliderDisagreementM<.0001,'measure the published visual and collision surface');
    assert.ok(row.analyticContourRadiiM.every(r=>Math.abs(r-row.requestedRadiusM)<1),'analytic relief contour cross-check');
    assert.equal(row.maxOpeningRadiusErrorM,Math.max(...row.measuredOpeningRadiiM.map(r=>Math.abs(r-row.requestedRadiusM))));
  }
});
test('T_D11_SMALL_CRATER_DEPTH_ERROR_MEASURED',()=>{
  for(const row of rows) {
    assert.equal(row.spacingM,8);
    assert.equal(row.cellsAcrossDiameter,2*row.requestedRadiusM/row.spacingM);
    assert.equal(row.cellsAcrossDepth,row.requestedDepthM/row.spacingM);
    assert.equal(row.depthErrorM,Math.abs(row.measuredDepthM-row.requestedDepthM));
    assert.equal(row.depthToleranceM,Math.min(4,row.requestedDepthM*.15));
    assert.ok(Number.isFinite(row.measuredDepthM)&&row.measuredDepthM>0);
  }
});
test('fidelity acceptance rejects a measured rim or depth beyond the declared tolerance',()=>{
  const row=rows[0];
  assert.equal(craterFidelityAccepted({...row,maxOpeningRadiusErrorM:8,depthErrorM:row.depthToleranceM}),true);
  assert.equal(craterFidelityAccepted({...row,maxOpeningRadiusErrorM:8.001,depthErrorM:0}),false);
  assert.equal(craterFidelityAccepted({...row,maxOpeningRadiusErrorM:0,depthErrorM:row.depthToleranceM+.001}),false);
  assert.equal(CRATER_FIDELITY_TOLERANCE.radiusM,8);
});
