import { ABILITIES, PLANTS, RULES, SCALE, TICK_RATE, ZOMBIES, ZOMBIE_TYPES } from './config';
import type { ZombieType } from './config';
import { hash } from './random';
import type { Command, GameMap, Plant, SimEvent, Snapshot, Zombie } from './types';

export class GameSimulation {
  readonly map: GameMap;
  readonly state: Snapshot;
  private nextId = 100;
  private eventId = 0;
  private pending: Command[] = [];
  private trapHits = new Map<string, number>();
  constructor(map: GameMap) {
    this.map = map;
    this.state = {
      tick: 0,
      status: 'running',
      energy: RULES.energy * 1000,
      coreHp: RULES.coreHp * 1000,
      zombies: [],
      plants: map.plants.map((p) => ({
        ...p,
        hp: PLANTS[p.type].hp * 1000,
        maxHp: PLANTS[p.type].hp * 1000,
        nextAttack: 1,
      })),
      projectiles: [],
      events: [],
      cooldowns: Object.fromEntries(ZOMBIE_TYPES.map((t) => [t, 0])) as Record<ZombieType, number>,
      commands: [],
      spent: 0,
      deployed: 0,
    };
  }
  queue(command: Command) {
    if (
      !Number.isInteger(command.tick) ||
      command.tick <= this.state.tick ||
      !Number.isInteger(command.order) ||
      command.type !== 'deploy' ||
      !ZOMBIE_TYPES.includes(command.unit) ||
      !Number.isInteger(command.row) ||
      command.row < 0 ||
      command.row >= RULES.rows
    )
      return false;
    this.pending.push({ ...command });
    this.pending.sort((a, b) => a.tick - b.tick || a.order - b.order);
    return true;
  }
  canDeploy(unit: ZombieType) {
    return (
      this.state.status === 'running' &&
      this.state.energy >= ZOMBIES[unit].cost * 1000 &&
      this.state.tick >= this.state.cooldowns[unit]
    );
  }
  private event(
    type: SimEvent['type'],
    x: number,
    row: number,
    amount?: number,
    side?: SimEvent['side'],
  ) {
    this.state.events.push({
      id: ++this.eventId,
      tick: this.state.tick,
      type,
      x,
      row,
      amount,
      side,
    });
  }
  private hurtZombie(z: Zombie, damage: number, kind = 'normal') {
    const amount = Math.round(
      damage * (z.type === 'armor' && kind === 'normal' ? 1 - ABILITIES.armorReduction : 1),
    );
    z.hp -= amount;
    this.event('hit', z.x, z.row, amount / 1000, 'zombie');
  }
  private hurtPlant(p: Plant, damage: number) {
    p.hp -= damage;
    this.event('hit', (p.col + 0.5) * SCALE, p.row, damage / 1000, 'plant');
  }
  private blast(x: number, row: number, damage: number, radius: number, side: 'plant' | 'zombie') {
    this.event('explosion', x, row, radius, side);
    if (side === 'plant') {
      for (const p of this.state.plants)
        if (p.hp > 0 && this.inRadius(x, row, (p.col + 0.5) * SCALE, p.row, radius))
          this.hurtPlant(p, damage);
      if (12 - x / SCALE <= radius) {
        this.state.coreHp -= damage;
        this.event('core', 12 * SCALE, row, damage / 1000);
      }
    } else
      for (const z of this.state.zombies)
        if (z.hp > 0 && !z.underground && this.inRadius(x, row, z.x, z.row, radius))
          this.hurtZombie(z, damage, 'blast');
  }
  private inRadius(x: number, row: number, tx: number, tr: number, radius: number) {
    return (x - tx) ** 2 + ((row - tr) * SCALE) ** 2 <= (radius * SCALE) ** 2;
  }
  private cleanup() {
    for (const p of this.state.plants)
      if (p.hp <= 0) {
        this.event('death', (p.col + 0.5) * SCALE, p.row, undefined, 'plant');
        if (p.type === 'flower')
          this.state.energy = Math.min(
            RULES.maxEnergy * 1000,
            this.state.energy + ABILITIES.flowerEnergy * 1000,
          );
      }
    for (const z of this.state.zombies)
      if (z.hp <= 0) this.event('death', z.x, z.row, undefined, 'zombie');
    this.state.plants = this.state.plants.filter((p) => p.hp > 0);
    this.state.zombies = this.state.zombies.filter((z) => z.hp > 0);
  }
  step() {
    const s = this.state;
    if (s.status !== 'running') return;
    s.tick++;
    s.events = s.events.filter((e) => s.tick - e.tick <= 24);
    // 用累计整数差分恢复资源，避免每帧舍入造成长期漂移。
    s.energy = Math.min(
      RULES.maxEnergy * 1000,
      s.energy +
        Math.floor((s.tick * RULES.regen * 1000) / TICK_RATE) -
        Math.floor(((s.tick - 1) * RULES.regen * 1000) / TICK_RATE),
    );
    while (this.pending[0]?.tick <= s.tick) {
      const c = this.pending.shift()!;
      if (!this.canDeploy(c.unit)) continue;
      const d = ZOMBIES[c.unit];
      s.energy -= d.cost * 1000;
      s.spent += d.cost;
      s.deployed++;
      s.cooldowns[c.unit] = s.tick + d.cooldown;
      s.commands.push(c);
      s.zombies.push({
        id: this.nextId++,
        type: c.unit,
        row: c.row,
        x: 0,
        hp: d.hp * 1000,
        maxHp: d.hp * 1000,
        nextAttack: s.tick,
        slowUntil: 0,
        underground: c.unit === 'digger',
        attacking: false,
      });
      this.event('deploy', 0, c.row);
    }
    // 固定阶段和稳定插入顺序决定同 Tick 的目标及伤害，渲染不参与规则。
    for (const p of s.plants)
      if (p.type === 'detector' && p.hp > 0) {
        for (const z of s.zombies)
          if (
            z.underground &&
            z.row === p.row &&
            Math.abs(z.x / SCALE - p.col - 0.5) <= 3 &&
            !this.map.terrain.some(
              (t) => t.type === 'tunnel' && t.row === z.row && t.col === Math.floor(z.x / SCALE),
            )
          ) {
            z.underground = false;
            this.event('reveal', z.x, z.row);
          }
      }
    for (const z of s.zombies) {
      if (z.hp <= 0) continue;
      if (z.underground && z.x >= ABILITIES.burrowEnd * SCALE) {
        z.underground = false;
        this.event('reveal', z.x, z.row);
      }
      z.attacking = false;
      const blocker = !z.underground
        ? s.plants
            .filter(
              (p) => p.hp > 0 && p.row === z.row && (p.col + 0.5) * SCALE >= z.x - 0.4 * SCALE,
            )
            .sort((a, b) => a.col - b.col || a.id - b.id)[0]
        : undefined;
      const targetX = blocker ? (blocker.col + 0.1) * SCALE : 11.6 * SCALE;
      if (z.x >= targetX) {
        z.attacking = true;
        if (s.tick >= z.nextAttack) {
          const buff = s.zombies.some(
            (a) =>
              a.hp > 0 &&
              a.type === 'commander' &&
              this.inRadius(z.x, z.row, a.x, a.row, ABILITIES.commanderRange),
          )
            ? ABILITIES.commanderMultiplier
            : 1;
          const damage = Math.round(ZOMBIES[z.type].dps * 1000 * buff);
          if (z.type === 'bomber') {
            this.blast(z.x, z.row, damage, ABILITIES.blastRadius, 'plant');
            z.hp = 0;
          } else if (blocker) this.hurtPlant(blocker, damage);
          else {
            s.coreHp -= damage;
            this.event('core', 12 * SCALE, z.row, damage / 1000);
          }
          z.nextAttack = s.tick + 30;
        }
      } else {
        let factor = s.tick < z.slowUntil ? ABILITIES.frostMultiplier : 1;
        if (!z.underground)
          for (const t of this.map.terrain)
            if (t.row === z.row && t.col === Math.floor(z.x / SCALE))
              factor *=
                t.type === 'mud'
                  ? ABILITIES.mudMultiplier
                  : t.type === 'road'
                    ? ABILITIES.roadMultiplier
                    : t.type === 'rock'
                      ? ABILITIES.rockMultiplier
                      : 1;
        z.x = Math.min(
          targetX,
          z.x + Math.round(((ZOMBIES[z.type].speed * SCALE) / TICK_RATE) * factor),
        );
      }
    }
    this.cleanup();
    if (s.coreHp <= 0) {
      s.coreHp = 0;
      s.status = 'won';
      this.event('win', 12 * SCALE, 2);
      return;
    }
    for (const p of s.plants) {
      const d = PLANTS[p.type];
      if (!d.damage || s.tick < p.nextAttack) continue;
      const target = s.zombies
        .filter(
          (z) =>
            z.hp > 0 &&
            !z.underground &&
            z.row === p.row &&
            z.x <= (p.col + 0.65) * SCALE &&
            (p.col + 0.5) * SCALE - z.x <= d.range * SCALE,
        )
        .sort((a, b) => b.x - a.x || a.id - b.id)[0];
      if (!target) continue;
      if (p.type === 'bomb') {
        this.blast(
          (p.col + 0.5) * SCALE,
          p.row,
          d.damage * 1000,
          ABILITIES.plantBombRadius,
          'zombie',
        );
        p.hp = 0;
      } else
        s.projectiles.push({
          id: this.nextId++,
          x: (p.col + 0.25) * SCALE,
          row: p.row,
          target: target.id,
          damage: d.damage * 1000,
          kind: p.type === 'frost' ? 'frost' : p.type === 'cannon' ? 'splash' : 'normal',
          speed: Math.round((7 * SCALE) / TICK_RATE),
        });
      p.nextAttack = s.tick + d.interval;
    }
    s.projectiles = s.projectiles.filter((b) => {
      const target = s.zombies.find((z) => z.id === b.target && z.hp > 0 && !z.underground);
      b.x -= b.speed;
      if (!target) return false;
      if (b.x <= target.x + 0.15 * SCALE) {
        if (b.kind === 'splash')
          this.blast(target.x, target.row, b.damage, ABILITIES.splashRadius, 'zombie');
        else {
          this.hurtZombie(target, b.damage, b.kind);
          if (b.kind === 'frost') target.slowUntil = s.tick + ABILITIES.frostDuration;
        }
        return false;
      }
      return b.x >= -SCALE;
    });
    for (const t of this.map.terrain)
      if (t.type === 'trap' && (s.tick + t.phase) % ABILITIES.trapPeriod < ABILITIES.trapActive) {
        const cycle = Math.floor((s.tick + t.phase) / ABILITIES.trapPeriod);
        for (const z of s.zombies) {
          const key = `${t.row}:${t.col}:${z.id}`;
          if (
            z.hp > 0 &&
            !z.underground &&
            z.row === t.row &&
            Math.floor(z.x / SCALE) === t.col &&
            this.trapHits.get(key) !== cycle
          ) {
            this.trapHits.set(key, cycle);
            this.hurtZombie(z, ABILITIES.trapDamage * 1000, 'trap');
            this.event('explosion', z.x, z.row, 0.5, 'zombie');
          }
        }
      }
    this.cleanup();
    if (s.tick >= RULES.limitTicks) s.status = 'lost';
  }
  checksum() {
    return hash(
      JSON.stringify({
        tick: this.state.tick,
        status: this.state.status,
        hp: this.state.coreHp,
        energy: this.state.energy,
        zombies: this.state.zombies,
        plants: this.state.plants,
        projectiles: this.state.projectiles,
        commands: this.state.commands,
      }),
    ).toString(16);
  }
}

/** 真实帧只贡献时间预算；每次推进的模拟步长永远为 1/30 秒。 */
export class FixedClock {
  private accumulator = 0;
  update(delta: number, sim: GameSimulation) {
    this.accumulator += Math.max(0, Math.min(delta, 250));
    let steps = 0;
    while (this.accumulator + 1e-7 >= 1000 / TICK_RATE) {
      sim.step();
      this.accumulator -= 1000 / TICK_RATE;
      steps++;
    }
    return steps;
  }
  reset() {
    this.accumulator = 0;
  }
}
