import { PLANTS, RULES, ZOMBIES } from './config';
import type { ZombieType } from './config';
import { GameSimulation } from './simulation';
import type { GameMap } from './types';
export type Strategy = 'balanced' | 'burrow' | 'swarm';
export function weakestLane(map: GameMap) {
  const scores = Array.from(
    { length: 5 },
    (_, row) =>
      map.plants
        .filter((p) => p.row === row)
        .reduce((sum, p) => sum + PLANTS[p.type].hp / 80 + PLANTS[p.type].budget, 0) +
      map.terrain.filter((t) => t.row === row && t.type === 'mud').length * 2,
  );
  return scores.indexOf(Math.min(...scores));
}
export function runBot(map: GameMap, strategy: Strategy = 'balanced') {
  const sim = new GameSimulation(map);
  const row = weakestLane(map);
  let order = 0;
  const cycle: ZombieType[] =
    strategy === 'burrow'
      ? ['digger', 'runner', 'basic', 'bomber']
      : strategy === 'swarm'
        ? ['basic', 'runner', 'bomber']
        : ['armor', 'runner', 'basic', 'bomber', 'commander'];
  while (sim.state.status === 'running' && sim.state.tick < RULES.limitTicks) {
    if (sim.state.tick % 15 === 0) {
      const living = sim.state.zombies.filter((z) => z.row === row);
      const preferred =
        !living.length && strategy === 'balanced' ? ['armor' as const, ...cycle] : cycle;
      const unit = preferred.find(
        (t) => sim.canDeploy(t) && sim.state.energy >= ZOMBIES[t].cost * 1000,
      );
      if (unit) sim.queue({ type: 'deploy', tick: sim.state.tick + 1, order: ++order, unit, row });
    }
    sim.step();
  }
  return {
    won: sim.state.status === 'won',
    ticks: sim.state.tick,
    replay: [...sim.state.commands],
    checksum: sim.checksum(),
    strategy,
  };
}
