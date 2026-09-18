import { BufferGeometry, Float32BufferAttribute, Group, LineBasicNodeMaterial, LineSegments, Vector3 } from 'three/webgpu';
import { positionLocal, time, vec3 } from 'three/tsl';
import type { WeatherKind } from '../core/types';
/** Rain is one draw call. Falling motion is evaluated on GPU with no per-drop JS objects. */
export class WeatherSystem {
  private rain: LineSegments;
  private flashTimer = 6;
  private stormTime = 0;
  constructor(root: Group) {
    const vertices = new Float32Array(900 * 6);
    for (let i = 0; i < 900; i++) { const x = Math.random() * 100 - 50, y = Math.random() * 70, z = Math.random() * 100 - 50; vertices.set([x,y,z,x-.18,y-1.5,z], i * 6); }
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    const mat = new LineBasicNodeMaterial({ color: '#b4d4d6', transparent: true, opacity: .43, depthWrite: false });
    mat.positionNode = vec3(positionLocal.x, positionLocal.y.sub(time.mul(33)).mod(70), positionLocal.z);
    this.rain = new LineSegments(geometry, mat); this.rain.frustumCulled = false; this.rain.visible = false; root.add(this.rain);
  }
  update(dt: number, player: Vector3, weather: WeatherKind): number {
    this.rain.visible = weather === 'rain' || weather === 'storm';
    this.rain.position.set(player.x, Math.max(0, player.y - 25), player.z);
    this.stormTime = Math.max(0, this.stormTime - dt);
    if (weather === 'storm') { this.flashTimer -= dt; if (this.flashTimer < 0) { this.flashTimer = 6 + Math.random() * 12; this.stormTime = .16; } }
    return this.stormTime > 0 ? 3 : 0;
  }
}
