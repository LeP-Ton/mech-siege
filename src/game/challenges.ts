import { RULES_VERSION } from './config';
import { runBot } from './bots';
import type { Difficulty } from './config';
import type { Challenge, GameMap, Grade, Thresholds } from './types';
export const THEMES = [
  { name: '废土前哨', subtitle: '引擎启动，从第一座前哨开始', color: '#dc985f' },
  { name: '合金工厂', subtitle: '重装推进，突破工业防线', color: '#a6b7c9' },
  { name: '地下能源站', subtitle: '沿检修通道，潜入阵地深处', color: '#59c4d2' },
  { name: '轨道港区', subtitle: '读懂磁轨与脉冲，掌握进攻节奏', color: '#69a9e8' },
  { name: '主控堡垒', subtitle: '集结全队，攻破最后的防御中枢', color: '#de7e74' },
];
const names = [
  '初次登陆',
  '废铁小径',
  '零号前哨',
  '落日封锁',
  '合金岗哨',
  '装甲闸门',
  '铸造车间',
  '钢铁之心',
  '掘进计划',
  '深层管廊',
  '地磁雷达',
  '无声突袭',
  '冷却回廊',
  '货运岔道',
  '脉冲时钟',
  '港区缺口',
  '重炮平台',
  '双重封锁',
  '能源熔炉',
  '终局破晓',
];
const seeds = [
  'DAWN01',
  'SUNFL2',
  'YARD03',
  'DUSK04',
  'STEEL1',
  'VINE02',
  'SPORE3',
  'IRON04',
  'DIG001',
  'TUNNL2',
  'RADAR3',
  'SILNT4',
  'MUD001',
  'PATH02',
  'CLOCK3',
  'OASIS4',
  'CANN01',
  'LOCK02',
  'BLOOM3',
  'FINAL4',
];
const styles = [5, 2, 1, 0, 1, 1, 0, 5, 3, 3, 3, 2, 4, 4, 6, 5, 0, 1, 6, 5];
// G1/R1 在三类机器人中实测的最佳 Tick，具体数据见 workflow 的评级标定记录。
const baselines = [
  746, 822, 758, 776, 866, 776, 916, 776, 812, 776, 769, 895, 916, 921, 826, 822, 788, 816, 993,
  776,
];
export const CHALLENGES: Challenge[] = names.map((name, i) => {
  const difficulty: Difficulty = i < 4 ? 'easy' : i < 12 ? 'normal' : i < 18 ? 'hard' : 'extreme';
  const b = baselines[i];
  return {
    id: `official-${i + 1}`,
    name,
    theme: Math.floor(i / 4),
    difficulty,
    seed: `ZVP-G1-${seeds[i]}`,
    style: styles[i],
    description: [
      '找到最薄弱的路线，让先锋先行。',
      '厚甲吸引火力，疾行紧随其后。',
      '潜入地下，小心地磁雷达的范围。',
      '利用道路与陷阱时机创造突破。',
      '配合爆破与指挥增益，全力推进。',
    ][Math.floor(i / 4)],
    thresholds: calibratedThresholds(b),
    rulesVersion: RULES_VERSION,
  };
});
function calibratedThresholds(base: number): Thresholds {
  return {
    SS: Math.round(base * 0.8),
    S: Math.round(base * 0.95),
    A: Math.round(base * 1.15),
    B: Math.round(base * 1.6),
  };
}
const thresholdCache = new Map<string, Thresholds>();
export function thresholdsFor(map: GameMap): Thresholds {
  const official = CHALLENGES.find((c) => c.seed === map.seed && c.difficulty === map.difficulty);
  if (official) return official.thresholds;
  const cached = thresholdCache.get(map.fingerprint);
  if (cached) return cached;
  const results = (['balanced', 'burrow', 'swarm'] as const)
    .map((s) => runBot(map, s))
    .filter((r) => r.won);
  const result = calibratedThresholds(Math.min(...results.map((r) => r.ticks), 4500));
  thresholdCache.set(map.fingerprint, result);
  return result;
}
export function gradeFor(ticks: number, thresholds: Thresholds): Grade {
  return ticks <= thresholds.SS
    ? 'SS'
    : ticks <= thresholds.S
      ? 'S'
      : ticks <= thresholds.A
        ? 'A'
        : ticks <= thresholds.B
          ? 'B'
          : 'C';
}
export function formatTime(ticks?: number | null) {
  if (ticks == null) return '—';
  const cs = Math.floor((ticks * 100) / 30);
  return `${String(Math.floor(cs / 6000)).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}
