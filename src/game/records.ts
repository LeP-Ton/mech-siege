import { GENERATOR_VERSION, RULES_VERSION, ZOMBIE_TYPES } from './config';
import { gradeFor } from './challenges';
import { GameSimulation } from './simulation';
import { formatSeed } from './random';
import type { GameMap, Grade, Replay, Thresholds } from './types';
export interface HistoryEntry {
  ticks: number;
  date: string;
  grade: Grade;
}
export interface PersonalRecord {
  seed: string;
  difficulty: GameMap['difficulty'];
  generatorVersion: string;
  rulesVersion: string;
  best: number | null;
  last: number | null;
  attempts: number;
  wins: number;
  grade: Grade | null;
  history: HistoryEntry[];
  replay?: Replay;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const RECORD_KEY = 'gamex.records.v1';
export function mapKey(
  map: Pick<GameMap, 'seed' | 'difficulty' | 'generatorVersion' | 'rulesVersion'>,
) {
  return `${map.seed}:${map.generatorVersion}:${map.rulesVersion}:${map.difficulty}`;
}
export class RecordStore {
  records: Record<string, PersonalRecord> = {};
  warning = '';
  constructor(private storage?: StorageLike) {
    try {
      const raw = storage?.getItem(RECORD_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.schema !== 1 || typeof data.records !== 'object' || !data.records)
          throw new Error('format');
        for (const [key, value] of Object.entries(data.records)) {
          const r = value as PersonalRecord;
          if (
            r &&
            typeof r.seed === 'string' &&
            Number.isInteger(r.attempts) &&
            Number.isInteger(r.wins) &&
            Array.isArray(r.history) &&
            (r.best === null || (Number.isInteger(r.best) && r.best > 0))
          )
            this.records[key] = r;
        }
      }
    } catch {
      this.warning = '本地纪录无法读取。本次可继续游戏，新成绩将尝试重新保存。';
    }
  }
  private save() {
    try {
      this.storage?.setItem(RECORD_KEY, JSON.stringify({ schema: 1, records: this.records }));
      if (this.storage) this.warning = '';
    } catch {
      this.warning = '浏览器未能保存纪录（可能空间不足或禁止存储），本次成绩仅保留在当前页面。';
    }
  }
  get(map: GameMap) {
    return this.records[mapKey(map)];
  }
  start(map: GameMap) {
    const key = mapKey(map);
    this.records[key] ??= {
      seed: map.seed,
      difficulty: map.difficulty,
      generatorVersion: map.generatorVersion,
      rulesVersion: map.rulesVersion,
      best: null,
      last: null,
      attempts: 0,
      wins: 0,
      grade: null,
      history: [],
    };
    this.records[key].attempts++;
    this.save();
  }
  finish(sim: GameSimulation, thresholds: Thresholds) {
    if (sim.state.status !== 'won') return false;
    const key = mapKey(sim.map);
    if (!this.records[key]) this.start(sim.map);
    const r = this.records[key],
      ticks = sim.state.tick,
      best = r.best === null || ticks < r.best;
    r.last = ticks;
    r.wins++;
    r.history.unshift({
      ticks,
      date: new Date().toISOString(),
      grade: gradeFor(ticks, thresholds),
    });
    r.history = r.history.slice(0, 30);
    if (best) {
      r.best = ticks;
      r.grade = gradeFor(ticks, thresholds);
      r.replay = makeReplay(sim);
    }
    this.save();
    return best;
  }
}
export function makeReplay(sim: GameSimulation): Replay {
  return {
    schema: 1,
    seed: sim.map.seed,
    difficulty: sim.map.difficulty,
    generatorVersion: GENERATOR_VERSION,
    rulesVersion: RULES_VERSION,
    fingerprint: sim.map.fingerprint,
    loadout: [...ZOMBIE_TYPES],
    commands: structuredClone(sim.state.commands),
    finalTick: sim.state.tick,
    checksum: sim.checksum(),
  };
}
export function loadReplay(map: GameMap, replay: Replay) {
  if (
    replay.schema !== 1 ||
    replay.rulesVersion !== RULES_VERSION ||
    replay.generatorVersion !== GENERATOR_VERSION ||
    replay.fingerprint !== map.fingerprint ||
    replay.seed !== map.seed ||
    replay.difficulty !== map.difficulty
  )
    throw new Error('回放版本或地图不兼容，无法重放。');
  if (
    !Array.isArray(replay.commands) ||
    replay.commands.length > 2000 ||
    !Number.isInteger(replay.finalTick) ||
    replay.finalTick <= 0 ||
    replay.finalTick > 6300 ||
    typeof replay.checksum !== 'string' ||
    !Array.isArray(replay.loadout) ||
    replay.loadout.join(',') !== ZOMBIE_TYPES.join(',')
  )
    throw new Error('回放数据损坏，无法重放。');
  const sim = new GameSimulation(map);
  for (const command of replay.commands) if (!sim.queue(command)) throw new Error('回放命令无效。');
  return sim;
}
export interface LeaderboardEntry {
  seed: string;
  rulesVersion: string;
  difficulty: string;
  ticks: number;
  replay: Replay;
}
/** 未来服务端必须重放命令验证成绩，本地不提供虚假排行。 */
export interface LeaderboardGateway {
  submit(entry: LeaderboardEntry): Promise<void>;
  list(seed: string): Promise<LeaderboardEntry[]>;
}
export function challengeUrl(map: GameMap) {
  const url = new URL(location.href);
  url.search = new URLSearchParams({
    seed: formatSeed(map.seed),
    difficulty: map.difficulty,
    rules: map.rulesVersion,
  }).toString();
  return url.toString();
}
export function shareText(map: GameMap, ticks?: number | null) {
  return `🤖《机械围城》· 攻城竞速挑战\n种子：${formatSeed(map.seed)}\n难度：${map.difficulty} · 规则：${map.rulesVersion}${ticks ? `\n我的纪录：${Math.floor((ticks * 100) / 30) / 100} 秒` : ''}\n部署机器人，突破同一座防御阵地！\n${challengeUrl(map)}`;
}
