import type { Vector3 } from 'three/webgpu';
import type { TerrainProvider } from '../../../physics/PhysicsWorld';
import type { ReferenceFrameGraph } from '../../spatial/ReferenceFrameGraph';
import type { PlanetVolumeReplacementCoverage } from './PlanetVolumeReplacementCoverage';

/** Intact terrain remains everywhere except a published replacement's original surface point. */
export class PlanetVolumeTerrainProvider implements TerrainProvider {
  readonly heightfieldOnly=true;
  constructor(readonly intact:TerrainProvider,readonly coverage:PlanetVolumeReplacementCoverage,
    readonly frames:ReferenceFrameGraph,readonly bodyId:string,readonly fixedFrame:string,readonly localFrame:string) {}
  heightAt(x:number,z:number):number {
    const height=this.intact.heightAt(x,z);if(!Number.isFinite(height))return height;
    const point=this.frames.convertPosition(this.localFrame,this.fixedFrame,[x,height,z]);
    return this.coverage.contains(this.bodyId,point)?-Infinity:height;
  }
  raycast(origin:Vector3,direction:Vector3,maxDistance:number):number|null {
    const hit=this.intact.raycast?.(origin,direction,maxDistance);if(hit==null)return null;
    const point=this.frames.convertPosition(this.localFrame,this.fixedFrame,
      [origin.x+direction.x*hit,origin.y+direction.y*hit,origin.z+direction.z*hit]);
    return this.coverage.contains(this.bodyId,point)?null:hit;
  }
}
