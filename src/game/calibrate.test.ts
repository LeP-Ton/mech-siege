import { expect, it } from 'vitest';
import { CHALLENGES } from './challenges';
import { generateMap } from './maps';
import { runBot } from './bots';
it('官方评级基于实测通关且不同战术均具有竞速价值', () => {
  const results = CHALLENGES.map((c) => {
    const map = generateMap(c.seed, c.difficulty);
    const times = (['balanced', 'burrow', 'swarm'] as const).map((s) => runBot(map, s));
    const best = Math.min(...times.filter((t) => t.won).map((t) => t.ticks));
    expect(c.thresholds.A).toBeGreaterThan(best);
    expect(c.thresholds.SS).toBeLessThan(best);
    return {
      name: c.name,
      ticks: times.map((t) => (t.won ? t.ticks : null)),
      best,
      winner: times.find((t) => t.ticks === best)?.strategy,
    };
  });
  expect(new Set(results.map((r) => r.winner)).size).toBeGreaterThan(1);
});
