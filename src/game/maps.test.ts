import { describe, expect, it, vi } from 'vitest';
import { generateMap, validateMap } from './maps';
import { CHALLENGES } from './challenges';
import { runBot } from './bots';
import { DIFFICULTIES } from './config';
import type { Difficulty } from './config';
describe('种子生成与官方地图', () => {
  it('相同种子、难度、版本在清空模块缓存后仍生成相同地图', async () => {
    const first = generateMap(' zvp-g1-7j2k9q ');
    vi.resetModules();
    const fresh = await import('./maps');
    expect(fresh.generateMap('ZVP-G1-7J2K9Q')).toEqual(first);
    first.plants.splice(0);
    expect(fresh.generateMap('ZVP-G1-7J2K9Q').plants.length).toBeGreaterThan(0);
  });
  it('拒绝非法种子和未支持的生成器版本', () => {
    expect(() => generateMap('abc')).toThrow();
    expect(() => generateMap('ZVP-G2-ABCDEF')).toThrow();
  });
  it('多种子四档难度无重叠、越界、超预算，具备布局变化与可通关性', () => {
    const hashes = new Set<string>();
    for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[])
      for (let i = 0; i < 12; i++) {
        const map = generateMap(`ZVP-G1-TEST${String(i).padStart(2, '0')}`, difficulty);
        expect(validateMap(map), map.seed).toEqual([]);
        hashes.add(JSON.stringify({ plants: map.plants, terrain: map.terrain }));
        expect(runBot(map).won, `${map.seed}:${difficulty}`).toBe(true);
      }
    expect(hashes.size).toBeGreaterThan(44);
  }, 30000);
  it('全部20张官方地图合法且至少一种机器人能够通关', () => {
    expect(CHALLENGES).toHaveLength(20);
    for (const c of CHALLENGES) {
      const map = generateMap(c.seed, c.difficulty);
      expect(map.style).toBe(c.style);
      expect(validateMap(map)).toEqual([]);
      const results = (['balanced', 'burrow', 'swarm'] as const).map((s) => runBot(map, s));
      expect(
        results.some((r) => r.won),
        c.name,
      ).toBe(true);
      expect(results.every((r) => Number.isFinite(r.ticks) && r.ticks <= 6300)).toBe(true);
    }
  }, 30000);
});
