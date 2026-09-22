import { Quaternion, type Bone } from 'three/webgpu';
import library from './quaternius.json';

/** Retargeted CC0 keyframes, shared by the hero and echoes; no runtime asset requests. */
export class Locomotion {
  private current = '';
  private time = 0;
  private readonly a = new Quaternion();
  private readonly b = new Quaternion();
  apply(bones: readonly Bone[], dt: number, speed: number, flying: boolean, pose: string): void {
    const name = pose === 'punch' || pose === 'punchCross' ? pose : flying ? '' : pose === 'jump' || pose === 'vault' ? pose : !pose && speed > .4 ? speed > 8 ? 'run' : 'walk' : '';
    if (name !== this.current) { this.current = name; this.time = 0; }
    this.time += dt * (name === 'walk' ? Math.min(1.5, speed / 4) : name === 'run' ? Math.min(2, speed / 12) : 1);
    if (!name) return;
    const clip = library.clips[name as keyof typeof library.clips];
    const time = name.startsWith('punch') ? Math.min(this.time / .42, 1) * clip.duration : name === 'vault' ? Math.min(this.time, clip.duration) : this.time % clip.duration;
    const frame = time / clip.duration * (clip.frames.length - 1), index = Math.floor(frame);
    const first = clip.frames[index], next = clip.frames[Math.min(index + 1, clip.frames.length - 1)];
    for (let i = 0; i < bones.length; i++) {
      this.a.fromArray(first, i * 4); this.b.fromArray(next, i * 4);
      bones[i].quaternion.slerp(this.a.slerp(this.b, frame - index), 1 - Math.exp(-dt * 22));
    }
  }
}
