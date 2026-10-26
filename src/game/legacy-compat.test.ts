import { afterEach, describe, expect, it, vi } from 'vitest';
import baseline from './fixtures/legacy-r1.json';
import { generateMap } from './maps';
import { normalizeSeed, formatSeed } from './random';
import { challengeUrl, loadReplay, mapKey, RecordStore, shareText } from './records';
import type { GameMap, Replay } from './types';
describe('机械围城与 G1/R1 旧数据兼容', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('二十张官方地图的实际布局、身份与指纹不变', () => {
    for (const map of baseline.maps) {
      expect(generateMap(map.seed, map.difficulty as GameMap['difficulty'])).toEqual(map);
    }
  });
  it('新旧种子规范化为同一身份，展示与分享使用新前缀', () => {
    expect(normalizeSeed(' ms-g1-7j2k9q ')).toBe('ZVP-G1-7J2K9Q');
    expect(formatSeed('ZVP-G1-7J2K9Q')).toBe('MS-G1-7J2K9Q');
    const oldMap = generateMap('ZVP-G1-7J2K9Q');
    const newMap = generateMap('MS-G1-7J2K9Q');
    expect(newMap).toEqual(oldMap);
    expect(mapKey(newMap)).toBe(mapKey(oldMap));
    vi.stubGlobal('location', { href: 'http://localhost:5173/' });
    const link = new URL(challengeUrl(newMap));
    expect(link.searchParams.get('seed')).toBe('MS-G1-7J2K9Q');
    expect(link.searchParams.get('difficulty')).toBe(newMap.difficulty);
    expect(link.searchParams.get('rules')).toBe('R1');
    expect(shareText(newMap, 866)).toContain('《机械围城》');
    expect(shareText(newMap, 866)).toContain('MS-G1-7J2K9Q');
    expect(shareText(newMap, 866)).not.toContain('ZVP-G1');
  });
  it('旧版命令日志重现完全相同的 Tick 与终局校验值', () => {
    for (const sample of baseline.replays) {
      const map = generateMap(
        formatSeed(sample.map.seed),
        sample.map.difficulty as GameMap['difficulty'],
      );
      const sim = loadReplay(map, sample.replay as Replay);
      while (sim.state.status === 'running') sim.step();
      expect(sim.state.tick).toBe(sample.replay.finalTick);
      expect(sim.checksum()).toBe(sample.replay.checksum);
    }
  });
  it('原存档直接显示在新地图身份下，不重复建立档案', () => {
    const store = new RecordStore({ getItem: () => baseline.storage!, setItem: () => {} });
    for (const { map, replay } of baseline.replays) {
      const updated = generateMap(formatSeed(map.seed), map.difficulty as GameMap['difficulty']);
      expect(store.get(updated)?.best).toBe(replay.finalTick);
      expect(store.get(updated)?.replay?.checksum).toBe(replay.checksum);
    }
    expect(Object.keys(store.records)).toHaveLength(baseline.replays.length);
  });
});
