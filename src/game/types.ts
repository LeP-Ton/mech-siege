import type { Difficulty, PlantType, TerrainType, ZombieType } from './config';
export interface MapPlant {
  id: number;
  type: PlantType;
  row: number;
  col: number;
}
export interface Terrain {
  row: number;
  col: number;
  type: TerrainType;
  phase: number;
}
export interface GameMap {
  seed: string;
  generatorVersion: string;
  rulesVersion: string;
  difficulty: Difficulty;
  style: number;
  environment: number;
  plants: MapPlant[];
  terrain: Terrain[];
  budget: number;
  fallback: boolean;
  fingerprint: string;
}
export interface Command {
  tick: number;
  order: number;
  type: 'deploy';
  unit: ZombieType;
  row: number;
}
export interface Zombie {
  id: number;
  type: ZombieType;
  row: number;
  x: number;
  hp: number;
  maxHp: number;
  nextAttack: number;
  slowUntil: number;
  underground: boolean;
  attacking: boolean;
}
export interface Plant extends MapPlant {
  hp: number;
  maxHp: number;
  nextAttack: number;
}
export interface Projectile {
  id: number;
  row: number;
  x: number;
  target: number;
  damage: number;
  kind: 'normal' | 'frost' | 'splash';
  speed: number;
}
export interface SimEvent {
  id: number;
  tick: number;
  type: 'hit' | 'death' | 'explosion' | 'core' | 'deploy' | 'win' | 'reveal';
  x: number;
  row: number;
  amount?: number;
  side?: 'plant' | 'zombie';
}
export interface Snapshot {
  tick: number;
  status: 'running' | 'won' | 'lost';
  energy: number;
  coreHp: number;
  zombies: Zombie[];
  plants: Plant[];
  projectiles: Projectile[];
  events: SimEvent[];
  cooldowns: Record<ZombieType, number>;
  commands: Command[];
  spent: number;
  deployed: number;
}
export interface Replay {
  schema: 1;
  seed: string;
  generatorVersion: string;
  rulesVersion: string;
  difficulty: Difficulty;
  fingerprint: string;
  loadout: ZombieType[];
  commands: Command[];
  finalTick: number;
  checksum: string;
}
export type Grade = 'SS' | 'S' | 'A' | 'B' | 'C';
export interface Thresholds {
  SS: number;
  S: number;
  A: number;
  B: number;
}
export interface Challenge {
  id: string;
  name: string;
  theme: number;
  difficulty: Difficulty;
  seed: string;
  style: number;
  description: string;
  thresholds: Thresholds;
  rulesVersion: string;
}
