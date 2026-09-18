import type { Vector3 } from 'three/webgpu';
export interface Collider { x: number; y: number; z: number; width: number; height: number; depth: number; id?: string }
export interface Landmark { id: string; name: string; shortName: string; lat: number; lon: number; x: number; z: number; radius: number; spawnHeight: number; description: string }
export interface Target { id: string; position: Vector3; radius: number; kind: 'anomaly' | 'prop' | 'vehicle'; active: boolean }
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm';
export type TimeKind = 'Morning' | 'Noon' | 'Golden Hour' | 'Night';
