import { describe, expect, it, vi } from 'vitest';
import { generateMap } from './maps';
import { runBot } from './bots';
import { GameSimulation } from './simulation';
import { challengeUrl, loadReplay, makeReplay, mapKey, RecordStore, shareText } from './records';
import { thresholdsFor, gradeFor, formatTime } from './challenges';
describe('纪录、版本与回放', () => {
  const map = generateMap('ZVP-G1-REPLAY', 'easy');
  function battle() {
    const result = runBot(map);
    const sim = new GameSimulation(map);
    result.replay.forEach((c) => sim.queue(c));
    while (sim.state.status === 'running') sim.step();
    return sim;
  }
  it('相同命令完全重现终局、时间和校验值', () => {
    const first = battle(),
      replay = makeReplay(first),
      again = loadReplay(map, replay);
    while (again.state.status === 'running') again.step();
    expect(again.state.status).toBe('won');
    expect(again.state.tick).toBe(replay.finalTick);
    expect(again.checksum()).toBe(replay.checksum);
    expect(() => loadReplay({ ...map, fingerprint: 'different' }, replay)).toThrow();
    expect(() => loadReplay(map, { ...replay, finalTick: 99999 })).toThrow();
  });
  it('存取历史最佳、挑战次数与刷新后纪录', () => {
    const memory = new Map<string, string>(),
      storage = {
        getItem: (k: string) => memory.get(k) ?? null,
        setItem: (k: string, v: string) => {
          memory.set(k, v);
        },
      };
    const store = new RecordStore(storage),
      sim = battle();
    store.start(map);
    expect(store.finish(sim, thresholdsFor(map))).toBe(true);
    store.start(map);
    expect(store.finish(sim, thresholdsFor(map))).toBe(false);
    const refreshed = new RecordStore(storage);
    expect(refreshed.get(map)).toEqual(store.get(map));
    expect(refreshed.get(map)?.attempts).toBe(2);
    expect(refreshed.get(map)?.wins).toBe(2);
    expect(mapKey({ ...map, rulesVersion: 'R2' })).not.toBe(mapKey(map));
  });
  it('存储损坏或写入失败时保留可玩性并提示', () => {
    const store = new RecordStore({
      getItem: () => 'invalid',
      setItem: () => {
        throw Error('quota');
      },
    });
    expect(store.warning).toBeTruthy();
    expect(() => store.start(map)).not.toThrow();
    expect(store.get(map)?.attempts).toBe(1);
  });
  it('百分之一秒显示和评级边界正确', () => {
    expect(formatTime(30)).toBe('00:01.00');
    expect(formatTime(1)).toBe('00:00.03');
    expect(gradeFor(30, { SS: 30, S: 60, A: 90, B: 120 })).toBe('SS');
  });
  it('更快的真实通关会替换最佳回放并保留历史', () => {
    const quick = battle(),
      slow = new GameSimulation(map);
    quick.state.commands.forEach((c) => slow.queue({ ...c, tick: c.tick + 150 }));
    while (slow.state.status === 'running') slow.step();
    expect(slow.state.tick).toBeGreaterThan(quick.state.tick);
    const store = new RecordStore();
    store.start(map);
    store.finish(slow, thresholdsFor(map));
    store.start(map);
    expect(store.finish(quick, thresholdsFor(map))).toBe(true);
    expect(store.get(map)?.best).toBe(quick.state.tick);
    expect(store.get(map)?.replay?.checksum).toBe(quick.checksum());
    expect(store.get(map)?.history).toHaveLength(2);
  });
  it('分享URL包含全部地图身份信息，可重建相同布局', () => {
    vi.stubGlobal('location', { href: 'https://gamex.example/play' });
    try {
      const url = new URL(challengeUrl(map));
      expect(url.searchParams.get('rules')).toBe(map.rulesVersion);
      expect(url.searchParams.get('difficulty')).toBe(map.difficulty);
      expect(generateMap(url.searchParams.get('seed')!, map.difficulty)).toEqual(map);
      expect(shareText(map, 900)).toContain('30 秒');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
