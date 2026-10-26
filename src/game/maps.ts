import { DIFFICULTIES, GENERATOR_VERSION, PLANTS, RULES_VERSION } from './config';
import type { Difficulty, PlantType, TerrainType } from './config';
import { hash, normalizeSeed, rng } from './random';
import type { GameMap, MapPlant, Terrain } from './types';
import { runBot } from './bots';
import { CHALLENGES } from './challenges';
const cache = new Map<string, GameMap>();
const pools: PlantType[][] = [
  ['shooter', 'shooter', 'cannon', 'flower'],
  ['wall', 'shooter', 'frost', 'flower'],
  ['flower', 'flower', 'shooter', 'bomb'],
  ['wall', 'flower', 'detector', 'shooter'],
  ['frost', 'wall', 'bomb', 'flower'],
  ['cannon', 'shooter', 'flower', 'frost'],
  ['bomb', 'shooter', 'flower', 'frost'],
];
function candidate(
  seed: string,
  difficulty: Difficulty,
  attempt: number,
  forcedStyle?: number,
): GameMap {
  const random = rng(hash(`${seed}:${difficulty}:${attempt}`));
  const style = forcedStyle ?? Math.floor(random() * 7);
  const cfg = DIFFICULTIES[difficulty];
  const plants: MapPlant[] = [];
  const terrain: Terrain[] = [];
  const weak = Math.floor(random() * 5);
  let budget = 0;
  const add = (row: number, col: number, type: PlantType) => {
    if (
      plants.some((p) => p.row === row && p.col === col) ||
      budget + PLANTS[type].budget > cfg.budget ||
      plants.length >= cfg.maxPlants
    )
      return;
    plants.push({ id: plants.length + 1, row, col, type });
    budget += PLANTS[type].budget;
  };
  for (let row = 0; row < 5; row++) {
    add(
      row,
      4 + Math.floor(random() * 3),
      row === weak ? 'flower' : style === 1 || style === 3 ? 'wall' : 'shooter',
    );
  }
  for (let row = 0; row < 5; row++) {
    add(
      row,
      8 + Math.floor(random() * 3),
      row === weak ? 'flower' : pools[style][Math.floor(random() * pools[style].length)],
    );
  }
  for (let i = 0; i < 100 && budget < cfg.budget - 1 && plants.length < cfg.maxPlants; i++) {
    const row = Math.floor(random() * 5);
    if (row === weak && style === 5) continue;
    add(
      row,
      3 + Math.floor(random() * 8),
      pools[style][Math.floor(random() * pools[style].length)],
    );
  }
  const terrainTypes: TerrainType[] =
    style === 3
      ? ['tunnel', 'tunnel', 'road']
      : style === 6
        ? ['trap', 'road', 'trap']
        : ['mud', 'road', 'rock', 'tunnel'];
  for (let i = 0; i < cfg.terrains * 3 && terrain.length < cfg.terrains; i++) {
    const row = Math.floor(random() * 5),
      col = 2 + Math.floor(random() * 9);
    if (
      terrain.some((t) => t.row === row && t.col === col) ||
      plants.some((p) => p.row === row && p.col === col)
    )
      continue;
    terrain.push({
      row,
      col,
      type: terrainTypes[Math.floor(random() * terrainTypes.length)],
      phase: Math.floor(random() * 4) * 30,
    });
  }
  const map: GameMap = {
    seed,
    difficulty,
    generatorVersion: GENERATOR_VERSION,
    rulesVersion: RULES_VERSION,
    style,
    environment: Math.floor(random() * 5),
    plants,
    terrain,
    budget,
    fallback: false,
    fingerprint: '',
  };
  map.fingerprint = hash(JSON.stringify({ seed, difficulty, style, plants, terrain })).toString(16);
  return map;
}
export function validateMap(map: GameMap): string[] {
  const errors: string[] = [];
  const cfg = DIFFICULTIES[map.difficulty];
  if (!cfg) return ['未知难度'];
  if (map.plants.length > cfg.maxPlants) errors.push('防御设备数量超限');
  const occupied = new Set<string>();
  for (const p of [...map.plants, ...map.terrain]) {
    if (
      !Number.isInteger(p.row) ||
      !Number.isInteger(p.col) ||
      p.row < 0 ||
      p.row >= 5 ||
      p.col < 2 ||
      p.col >= 11
    )
      errors.push('地图越界');
    const key = `${p.row}:${p.col}`;
    if (occupied.has(key)) errors.push('非法重叠');
    occupied.add(key);
  }
  const budget = map.plants.reduce((n, p) => n + PLANTS[p.type].budget, 0);
  if (budget > cfg.budget || budget < Math.floor(cfg.budget * 0.55) || budget !== map.budget)
    errors.push('防御预算非法');
  if (Array.from({ length: 5 }, (_, row) => map.plants.some((p) => p.row === row)).some((v) => !v))
    errors.push('缺少路线防御');
  return errors;
}
/** G1 实现冻结保留；未来新增版本通过注册表选择，不覆盖旧种子算法。 */
export function generateMap(input: string, difficulty: Difficulty = 'normal'): GameMap {
  const seed = normalizeSeed(input);
  const forcedStyle = CHALLENGES.find((c) => c.seed === seed)?.style;
  if (!(difficulty in DIFFICULTIES)) throw new Error('未知地图难度。');
  const key = `${seed}:${difficulty}:${forcedStyle ?? 'auto'}:${RULES_VERSION}`;
  const cached = cache.get(key);
  if (cached) return structuredClone(cached);
  for (let attempt = 0; attempt < 4; attempt++) {
    const map = candidate(seed, difficulty, attempt, forcedStyle);
    if (!validateMap(map).length && runBot(map).won) {
      cache.set(key, map);
      return structuredClone(map);
    }
  }
  // 有上限的候选生成失败时，降为确定性的薄弱路线；保留其余防御预算。
  const map = candidate(seed, difficulty, 4, forcedStyle);
  map.plants
    .filter((p) => p.row === 0)
    .forEach((p) => {
      p.type = 'flower';
    });
  map.budget = map.plants.reduce((s, p) => s + PLANTS[p.type].budget, 0);
  map.fallback = true;
  map.fingerprint = hash(
    JSON.stringify({ seed, difficulty, plants: map.plants, terrain: map.terrain }),
  ).toString(16);
  cache.set(key, map);
  return structuredClone(map);
}
