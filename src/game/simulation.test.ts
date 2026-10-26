import { describe, expect, it } from 'vitest';
import { GameSimulation, FixedClock } from './simulation';
import { PLANTS, RULES, SCALE } from './config';
import type { GameMap } from './types';
const empty = (): GameMap => ({
  seed: 'ZVP-G1-TEST01',
  generatorVersion: 'G1',
  rulesVersion: 'R1',
  difficulty: 'easy',
  style: 0,
  environment: 0,
  plants: [],
  terrain: [],
  budget: 0,
  fingerprint: 'test',
  fallback: false,
});
function advance(sim: GameSimulation, ticks: number) {
  for (let i = 0; i < ticks; i++) sim.step();
}
describe('确定性战斗规则', () => {
  it('资源不足、冷却、非法路线不能部署', () => {
    const sim = new GameSimulation(empty());
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'commander', row: 0 });
    sim.queue({ tick: 1, order: 2, type: 'deploy', unit: 'commander', row: 0 });
    expect(sim.queue({ tick: 1, order: 3, type: 'deploy', unit: 'basic', row: 5 })).toBe(false);
    sim.step();
    expect(sim.state.zombies).toHaveLength(1);
    expect(sim.state.energy).toBeLessThan(21_000);
    expect(sim.canDeploy('commander')).toBe(false);
  });
  it('准确恢复电能并遵守上限', () => {
    const sim = new GameSimulation(empty());
    advance(sim, 30);
    expect(sim.state.energy).toBe(168_000);
    advance(sim, 3000);
    expect(sim.state.energy).toBe(320_000);
  });
  it('移动、阻挡、攻击、防御设备死亡与补给', () => {
    const map = empty();
    map.plants = [{ id: 1, type: 'flower', row: 0, col: 2 }];
    const sim = new GameSimulation(map);
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'basic', row: 0 });
    advance(sim, 130);
    expect(sim.state.plants[0].hp).toBeLessThan(PLANTS.flower.hp * 1000);
    advance(sim, 180);
    expect(sim.state.plants).toHaveLength(0);
    expect(sim.state.zombies[0].x).toBeGreaterThan(2.1 * SCALE);
  });
  it('防御设备固定攻击、减速、地下绕过与探测', () => {
    const map = empty();
    map.plants = [
      { id: 1, type: 'frost', row: 0, col: 3 },
      { id: 2, type: 'detector', row: 1, col: 3 },
    ];
    const sim = new GameSimulation(map);
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'basic', row: 0 });
    sim.queue({ tick: 1, order: 2, type: 'deploy', unit: 'digger', row: 1 });
    advance(sim, 100);
    expect(sim.state.zombies[0].hp).toBeLessThan(160_000);
    expect(sim.state.zombies[0].slowUntil).toBeGreaterThan(0);
    expect(sim.state.zombies.find((z) => z.type === 'digger')?.underground).toBe(false);
  });
  it('核心归零立即胜利且终局不再推进', () => {
    const sim = new GameSimulation(empty());
    sim.state.coreHp = 1000;
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'runner', row: 2 });
    advance(sim, 600);
    expect(sim.state.status).toBe('won');
    expect(sim.state.coreHp).toBe(0);
    const tick = sim.state.tick;
    sim.step();
    expect(sim.state.tick).toBe(tick);
  });
  it('无操作在210秒正常失败', () => {
    const sim = new GameSimulation(empty());
    advance(sim, 7000);
    expect(sim.state.tick).toBe(RULES.limitTicks);
    expect(sim.state.status).toBe('lost');
  });
  it('30、60、144 FPS 下模拟结果一致', () => {
    const checks: string[] = [];
    for (const fps of [30, 60, 144]) {
      const sim = new GameSimulation(empty()),
        clock = new FixedClock();
      sim.queue({ tick: 10, order: 1, type: 'deploy', unit: 'runner', row: 0 });
      for (let i = 0; i < fps * 10; i++) clock.update(1000 / fps, sim);
      expect(sim.state.tick).toBe(300);
      checks.push(sim.checksum());
    }
    expect(new Set(checks).size).toBe(1);
  });
  it('铁甲只减少普通弹丸伤害，冰弹不减伤', () => {
    const sim = new GameSimulation(empty());
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'armor', row: 0 });
    sim.step();
    const z = sim.state.zombies[0];
    sim.state.projectiles.push({
      id: 900,
      row: 0,
      x: 0,
      target: z.id,
      damage: 10_000,
      kind: 'normal',
      speed: SCALE,
    });
    sim.step();
    expect(z.hp).toBe(412_000);
    sim.state.projectiles.push({
      id: 901,
      row: 0,
      x: 0,
      target: z.id,
      damage: 10_000,
      kind: 'frost',
      speed: SCALE,
    });
    sim.step();
    expect(z.hp).toBe(402_000);
  });
  it('指挥官按距离提供30%伤害增益且不重复叠加', () => {
    const map = empty();
    map.plants = [{ id: 1, type: 'wall', col: 2, row: 0 }];
    const sim = new GameSimulation(map);
    sim.state.energy = 320_000;
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'basic', row: 0 });
    sim.queue({ tick: 1, order: 2, type: 'deploy', unit: 'commander', row: 0 });
    sim.step();
    sim.state.zombies.forEach((z) => {
      z.x = 2.1 * SCALE;
    });
    sim.step();
    expect(sim.state.plants[0].hp).toBe(300_000 - 23_400 - 15_600);
  });
  it('爆破对相邻路线造成范围伤害并消耗自身', () => {
    const map = empty();
    map.plants = [
      { id: 1, type: 'wall', col: 2, row: 0 },
      { id: 2, type: 'wall', col: 2, row: 1 },
    ];
    const sim = new GameSimulation(map);
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'bomber', row: 0 });
    sim.step();
    sim.state.zombies[0].x = 2.1 * SCALE;
    sim.step();
    expect(sim.state.zombies).toHaveLength(0);
    expect(sim.state.plants.map((p) => p.hp)).toEqual([110_000, 110_000]);
  });
  it('一次性防御设备陷阱触发后死亡并消灭无护甲疾行', () => {
    const map = empty();
    map.plants = [{ id: 1, type: 'bomb', col: 2, row: 0 }];
    const sim = new GameSimulation(map);
    sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'runner', row: 0 });
    sim.step();
    sim.state.zombies[0].x = 2 * SCALE;
    sim.step();
    expect(sim.state.zombies).toHaveLength(0);
    expect(sim.state.plants).toHaveLength(0);
  });
  it('脉冲电网在固定相位触发，冷却液洼地与磁轨加速带影响地上移速', () => {
    const mud = empty();
    mud.terrain = [{ row: 0, col: 0, type: 'mud', phase: 0 }];
    const road = empty();
    road.terrain = [{ row: 0, col: 0, type: 'road', phase: 0 }];
    const a = new GameSimulation(mud),
      b = new GameSimulation(road);
    for (const sim of [a, b]) {
      sim.queue({ tick: 1, order: 1, type: 'deploy', unit: 'basic', row: 0 });
      advance(sim, 15);
    }
    expect(a.state.zombies[0].x).toBeLessThan(b.state.zombies[0].x);
    const trap = empty();
    trap.terrain = [{ row: 0, col: 0, type: 'trap', phase: 0 }];
    const c = new GameSimulation(trap);
    c.state.tick = 119;
    c.queue({ tick: 120, order: 1, type: 'deploy', unit: 'armor', row: 0 });
    c.step();
    expect(c.state.zombies[0].hp).toBe(385_000);
    advance(c, 5);
    expect(c.state.zombies[0].hp).toBe(385_000);
  });
});
