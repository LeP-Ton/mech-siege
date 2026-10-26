import Phaser from 'phaser';
import { ABILITIES, DEFENSES, RULES, SCALE } from '../game/config';
import { FixedClock, GameSimulation } from '../game/simulation';
import { ACTOR_TYPES, UNIT_VISUALS, actorPose, environmentUrl } from './art';
import type { ActorType } from './art';
import {
  CORE_POSITION,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  LANE_EDGES,
  fieldPoint,
  laneAt,
} from './battlefield';
import { sound } from './audio';
import { PART_ATLASES } from './rigs';
import { ROBOT_TYPES, ROBOT_RIG_URLS } from './robotPose';
import { RobotActor } from './RobotActor';

export interface SceneBridge {
  sim: GameSimulation;
  paused: boolean;
  reducedMotion: boolean;
  replay: boolean;
  speed: number;
  onUpdate: () => void;
  onLane: (row: number) => void;
  onReady: () => void;
  onLoadError: (file: string) => void;
}
interface Ghost {
  sprite: Phaser.GameObjects.Image;
  born: number;
  x: number;
  y: number;
}
interface Shell {
  x: number;
  y: number;
  born: number;
  variant: number;
}

export class BattleScene extends Phaser.Scene {
  private bridge: SceneBridge;
  private clock = new FixedClock();
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private positions = new Map<number, number>();
  private rigActors = new Map<number, RobotActor>();
  private walkDistances = new Map<number, number>();
  private labels = new Map<number, Phaser.GameObjects.Text>();
  private attacks = new Map<number, number>();
  private ghosts: Ghost[] = [];
  private shells: Shell[] = [];
  private background!: Phaser.GameObjects.Image;
  private floor!: Phaser.GameObjects.Graphics;
  private shadows!: Phaser.GameObjects.Graphics;
  private foreground!: Phaser.GameObjects.Graphics;
  private laneLabels: Phaser.GameObjects.Text[] = [];
  private hover = -1;
  private seenEvent = 0;
  private lastUi = -1;
  private vertical = 1;
  private core!: Phaser.GameObjects.Image;
  constructor(bridge: SceneBridge) {
    super('Battle');
    this.bridge = bridge;
  }
  preload() {
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.bridge.onLoadError(file.key));
    this.load.image('environment', environmentUrl(this.bridge.sim.map));
    for (const type of ACTOR_TYPES) {
      const v = UNIT_VISUALS[type];
      this.load.spritesheet(type, v.src, { frameWidth: v.frameWidth, frameHeight: v.frameHeight });
    }
    for (const type of ROBOT_TYPES) this.load.image(`rig-${type}`, ROBOT_RIG_URLS[type]);
    for (const atlas of Object.values(PART_ATLASES)) this.load.image(atlas.key, atlas.src);
  }
  create() {
    this.background = this.add.image(0, 0, 'environment').setOrigin(0).setDepth(-10);
    this.floor = this.add.graphics().setDepth(0);
    this.shadows = this.add.graphics().setDepth(5);
    this.core = this.add.image(0, 0, 'core', 0).setDepth(100 + CORE_POSITION.y);
    this.foreground = this.add.graphics().setDepth(900);
    for (let r = 0; r < 5; r++) {
      this.laneLabels.push(
        this.add
          .text(0, 0, `0${r + 1}  »`, {
            fontSize: '14px',
            color: '#d8f7e2',
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#20313a',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(6),
      );
    }
    this.resize();
    this.scale.on('resize', this.resize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.resize, this));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const point = this.cameras.main.getWorldPoint(p.x, p.y);
      this.hover = laneAt(point.x, point.y / this.vertical);
    });
    this.input.on('gameout', () => {
      this.hover = -1;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const point = this.cameras.main.getWorldPoint(p.x, p.y);
      const row = laneAt(point.x, point.y / this.vertical);
      if (row >= 0) this.bridge.onLane(row);
    });
    this.bridge.onReady();
  }
  private point(column: number, row: number) {
    const p = fieldPoint(column, row);
    return { ...p, y: p.y * this.vertical };
  }
  private resize() {
    // 宽度固定为逻辑 1200，地面随窗口高度展开；角色保持等比，避免宽屏黑边与挤扁。
    const zoom = this.scale.width / FIELD_WIDTH;
    this.cameras.main.setZoom(zoom).setScroll(0, 0).setOrigin(0, 0);
    this.vertical = this.scale.height / zoom / FIELD_HEIGHT;
    this.background.setDisplaySize(FIELD_WIDTH, FIELD_HEIGHT * this.vertical);
    this.drawFloor();
    this.laneLabels.forEach((label, row) => {
      const p = this.point(0, row);
      label
        .setPosition(p.x - 40, p.y - 9 * this.vertical)
        .setFontSize(13 * Math.min(1, this.vertical));
    });
  }
  private drawFloor() {
    const g = this.floor;
    g.clear();
    for (const t of this.bridge.sim.map.terrain) {
      const p = this.point(t.col + 0.5, t.row);
      const x = p.x,
        y = p.y - 6 * this.vertical,
        width = 59 * p.scale,
        height = 25 * this.vertical;
      if (t.type === 'mud') {
        g.fillStyle(0x123f46, 0.55);
        g.fillEllipse(x, y, width, height);
        g.fillEllipse(x - 13, y + 2, width * 0.7, height * 0.8);
        g.lineStyle(1.3, 0x7ad2cf, 0.65);
        g.lineBetween(x - 18, y - 3, x + 7, y - 3);
        g.lineBetween(x - 5, y + 4, x + 19, y + 4);
      } else if (t.type === 'tunnel') {
        g.fillStyle(0x101d25, 0.75);
        g.fillEllipse(x, y, width, height);
        g.lineStyle(3, 0x758080, 0.8);
        g.strokeEllipse(x, y, width, height);
        g.lineStyle(2, 0x8fa3a4, 0.6);
        for (let i = -2; i <= 2; i++)
          g.lineBetween(x - 20, y + i * 3 * this.vertical, x + 20, y + i * 3 * this.vertical);
      } else if (t.type === 'road') {
        g.lineStyle(3, 0xffce78, 0.65);
        for (let i = -1; i <= 1; i++) {
          const px = x + i * 16;
          g.lineBetween(px - 5, y - 7 * this.vertical, px + 4, y);
          g.lineBetween(px + 4, y, px - 5, y + 7 * this.vertical);
        }
      } else if (t.type === 'rock') {
        g.fillStyle(0x1c2229, 0.35);
        g.fillEllipse(x + 6, y + 3, width, height);
        for (let i = 0; i < 3; i++) {
          const px = x + (i - 1) * 16,
            py = y + (i % 2) * 4;
          g.fillStyle(i % 2 ? 0x626265 : 0x424e55, 1);
          g.fillTriangle(px - 12, py, px + 10, py, px - 4, py - (10 + i * 3) * this.vertical);
          g.lineStyle(1, 0xb9aaa0, 0.65);
          g.lineBetween(px - 12, py, px - 4, py - (10 + i * 3) * this.vertical);
        }
      } else {
        g.lineStyle(3, 0x252d35, 0.8);
        g.strokeEllipse(x, y, width, height);
        g.lineStyle(1, 0xfaab79, 0.7);
        g.strokeEllipse(x, y, width - 5, height - 3);
        g.fillStyle(0xff9c6e, 0.8);
        for (const side of [-1, 1]) g.fillCircle(x + (side * width) / 2, y, 3);
      }
    }
  }
  private pose(
    image: Phaser.GameObjects.Image,
    type: ActorType,
    frame: number,
    x: number,
    y: number,
    scale = 1,
  ) {
    const pose = actorPose(type, frame, scale * Math.min(1.1, this.vertical * 1.12));
    image
      .setFrame(frame)
      .setOrigin(pose.originX, pose.originY)
      .setDisplaySize(pose.width, pose.height)
      .setPosition(x, y);
    return pose.height * (pose.originY - 0.07);
  }
  update(_time: number, delta: number) {
    const b = this.bridge,
      s = b.sim.state;
    const running = !b.paused && s.status === 'running';
    if (running) this.clock.update(delta * b.speed, b.sim);
    else this.clock.reset();
    if (s.tick !== this.lastUi && (s.tick % 3 === 0 || s.status !== 'running')) {
      this.lastUi = s.tick;
      b.onUpdate();
    }
    if (!this.foreground) return;
    const g = this.foreground,
      shadows = this.shadows;
    g.clear();
    shadows.clear();
    const coreFrame = s.status === 'won' ? 3 : s.coreHp < 150000 ? 2 : 0;
    const coreHeight = this.pose(
      this.core,
      'core',
      coreFrame,
      CORE_POSITION.x,
      CORE_POSITION.y * this.vertical,
    );
    shadows.fillStyle(0x161b24, 0.34);
    shadows.fillEllipse(
      CORE_POSITION.x + 14,
      CORE_POSITION.y * this.vertical - 2,
      148,
      37 * this.vertical,
    );
    shadows.fillStyle(0xff873a, 0.12);
    shadows.fillEllipse(CORE_POSITION.x, CORE_POSITION.y * this.vertical, 164, 48 * this.vertical);
    if (this.hover >= 0 && !b.replay && running) {
      const row = this.hover,
        left = fieldPoint(0, row).x,
        right = fieldPoint(12, row).x;
      const top = LANE_EDGES[row] * this.vertical,
        bottom = LANE_EDGES[row + 1] * this.vertical;
      shadows.fillStyle(0x9aefd8, 0.09);
      shadows.fillPoints(
        [
          new Phaser.Geom.Point(left, top),
          new Phaser.Geom.Point(right, top),
          new Phaser.Geom.Point(right + 5, bottom),
          new Phaser.Geom.Point(left - 10, bottom),
        ],
        true,
      );
      g.lineStyle(2, 0xd1ffde, 0.65);
      g.lineBetween(left - 10, bottom - 5, left + 56, bottom - 5);
    }
    for (const t of b.sim.map.terrain)
      if (t.type === 'trap' && (s.tick + t.phase) % ABILITIES.trapPeriod < ABILITIES.trapActive) {
        const p = this.point(t.col + 0.5, t.row);
        g.lineStyle(2, 0xffc293, 0.8);
        g.lineBetween(p.x - 25, p.y - 5, p.x - 8, p.y - 18 * this.vertical);
        g.lineBetween(p.x - 8, p.y - 18 * this.vertical, p.x + 4, p.y - 3);
        g.lineBetween(p.x + 4, p.y - 3, p.x + 23, p.y - 21 * this.vertical);
      }
    const active = new Set<number>();
    for (const unit of [...s.plants, ...s.zombies]) {
      const robot = 'x' in unit,
        id = robot ? unit.id : -unit.id,
        visual = UNIT_VISUALS[unit.type];
      active.add(id);
      let image = this.sprites.get(id);
      if (!image) {
        image = this.add.image(0, 0, unit.type, 0);
        this.sprites.set(id, image);
      }
      const target = robot ? unit.x / SCALE : unit.col + 0.5;
      const previous = this.positions.get(id) ?? target;
      // 仅表现层平滑，模拟、命令与回放校验仍以整数 Tick 为准。
      const column = !robot
        ? target
        : running
          ? previous + (target - previous) * (1 - Math.exp((-Math.min(delta, 100) * b.speed) / 28))
          : previous;
      this.positions.set(id, column);
      if (robot)
        this.walkDistances.set(
          id,
          (this.walkDistances.get(id) ?? 0) +
            Math.max(0, fieldPoint(column, unit.row).x - fieldPoint(previous, unit.row).x),
        );
      const p = this.point(column, unit.row),
        x = p.x,
        y = p.y;
      const hurt = s.events.some(
        (e) =>
          e.type === 'hit' &&
          e.side === (robot ? 'zombie' : 'plant') &&
          e.row === unit.row &&
          s.tick - e.tick < 3 &&
          Math.abs(e.x / SCALE - target) < 0.18,
      );
      let frame = 0;
      if (!robot && hurt) frame = visual.animations.hit[0];
      else if (
        !robot &&
        unit.nextAttack - s.tick > DEFENSES[unit.type].interval - 5 &&
        DEFENSES[unit.type].damage > 0
      )
        frame = 2;
      // 炮塔待机固定底座，避免生成素材的两个待机姿态交替造成建筑晃动。
      const height = this.pose(image, unit.type, robot ? 0 : frame, x, y, p.scale);
      image.setVisible(!robot);
      image
        .setDepth(100 + fieldPoint(column, unit.row).y + (robot ? 2 : 0))
        .setAlpha(robot && unit.underground ? 0.38 : 1)
        .clearTint();
      if (robot && s.tick < unit.slowUntil) image.setTint(0xa5dfff);
      if (robot) {
        let actor = this.rigActors.get(id);
        if (!actor) {
          actor = new RobotActor(this, unit.type);
          this.rigActors.set(id, actor);
        }
        actor.update({
          x,
          y,
          height: visual.height * 0.84 * p.scale * Math.min(1.1, this.vertical * 1.12),
          distance: this.walkDistances.get(id) ?? 0,
          delta: delta * b.speed,
          frozen: !running,
          action: b.reducedMotion ? 'idle' : unit.attacking ? 'attack' : hurt ? 'hit' : 'walk',
          attackPulse: unit.nextAttack - s.tick > 20 ? 1 : 0.15,
          tint: s.tick < unit.slowUntil ? 0xa5dfff : hurt ? 0xffd2bb : undefined,
        });
        actor.container.setDepth(image.depth).setAlpha(unit.underground ? 0.38 : 1);
      }
      shadows.fillStyle(0x151921, robot ? 0.28 : 0.38);
      shadows.fillEllipse(
        x + 8 * p.scale,
        y + 1,
        (robot ? 45 : 57) * p.scale,
        13 * this.vertical * p.scale,
      );
      shadows.fillStyle(0x10161b, 0.22);
      shadows.fillEllipse(x, y - 1, 29 * p.scale, 6 * this.vertical);
      if (!robot) {
        shadows.lineStyle(2, 0x343c3b, 0.65);
        shadows.lineBetween(x + 16, y, x + 26, y + 5 * this.vertical);
        shadows.lineBetween(x + 26, y + 5 * this.vertical, x + 36, y + 5 * this.vertical);
        if (unit.nextAttack !== this.attacks.get(id)) {
          if (this.attacks.has(id) && DEFENSES[unit.type].damage > 0)
            this.shells.push({
              x: x - 28,
              y: y - height * 0.52,
              born: s.tick,
              variant: unit.type === 'frost' ? 1 : unit.type === 'cannon' ? 2 : 0,
            });
          this.attacks.set(id, unit.nextAttack);
        }
      }
      if (robot && unit.type === 'commander') {
        shadows.lineStyle(2, 0x72e6d0, 0.3);
        shadows.strokeEllipse(x, y, 170 * p.scale, 45 * this.vertical);
      }
      if (robot && unit.underground) {
        for (let i = 0; i < 4; i++) {
          const phase = (s.tick + i * 5) % 24;
          g.fillStyle(0xc4a681, 0.6 - phase / 45);
          g.fillCircle(x - phase, y - 5 - (i % 2) * 4, 2 + (i % 3));
        }
      }
      if (unit.hp < unit.maxHp) {
        g.fillStyle(0x111d25, 0.8);
        g.fillRect(x - 20, y - height - 7, 40, 4);
        g.fillStyle(robot ? 0x78e4cf : 0xff9d72);
        g.fillRect(x - 20, y - height - 7, Math.max(0, (unit.hp / unit.maxHp) * 40), 4);
      }
    }
    for (const [id, sprite] of this.sprites)
      if (!active.has(id)) {
        this.rigActors.get(id)?.destroy();
        this.rigActors.delete(id);
        this.walkDistances.delete(id);
        sprite.setVisible(true);
        const type = sprite.texture.key as ActorType;
        this.pose(sprite, type, id > 0 ? 7 : 3, sprite.x, sprite.y);
        this.ghosts.push({ sprite, born: s.tick, x: sprite.x, y: sprite.y / this.vertical });
        this.sprites.delete(id);
        this.positions.delete(id);
        this.attacks.delete(id);
      }
    this.ghosts = this.ghosts.filter((ghost) => {
      const age = s.tick - ghost.born;
      if (age > 20) {
        ghost.sprite.destroy();
        return false;
      }
      ghost.sprite.setPosition(ghost.x, ghost.y * this.vertical).setAlpha(0.65 * (1 - age / 22));
      return true;
    });
    for (const projectile of s.projectiles) {
      const p = this.point(projectile.x / SCALE, projectile.row),
        x = p.x,
        y = p.y - 35 * p.scale * Math.min(1.1, this.vertical);
      const color =
        projectile.kind === 'frost' ? 0xa8f1ff : projectile.kind === 'splash' ? 0xff8973 : 0xffd28a;
      g.fillStyle(color, 0.18);
      g.fillCircle(x, y, projectile.kind === 'splash' ? 13 : 7);
      g.lineStyle(3, color, 1);
      g.lineBetween(x + 10, y, x - 3, y);
      g.fillStyle(0xffffff);
      g.fillCircle(x - 3, y, 2);
    }
    this.shells = this.shells.filter((sh) => s.tick - sh.born < 16);
    for (const sh of this.shells) {
      const age = s.tick - sh.born;
      if (age < 5) {
        g.fillStyle(sh.variant === 1 ? 0xc5faff : 0xffc57f, 0.65 - age / 10);
        g.fillTriangle(sh.x, sh.y, sh.x - 20 - age * 2, sh.y - 8, sh.x - 18 - age * 2, sh.y + 7);
      }
      if (sh.variant === 0) {
        g.fillStyle(0xf1c47b, 1 - age / 20);
        g.fillRect(sh.x + age * 1.2, sh.y - age * 2 + age * age * 0.12, 4, 2);
      }
    }
    for (const e of s.events) {
      const age = s.tick - e.tick,
        p = this.point(e.x / SCALE, e.row),
        x = p.x,
        y = p.y - 35 * p.scale * Math.min(1.1, this.vertical),
        fade = Math.max(0, 1 - age / 25);
      if (e.id > this.seenEvent) {
        if (e.type === 'deploy') sound('deploy');
        if (e.type === 'win') sound('win');
        if (e.type === 'explosion' || e.type === 'core') {
          sound('hit');
          if (!b.reducedMotion && !b.paused) this.cameras.main.shake(90, 0.0015);
        }
        if ((e.type === 'hit' || e.type === 'core') && e.amount)
          this.labels.set(
            e.id,
            this.add
              .text(x, y - 16, `−${Math.round(e.amount)}`, {
                fontSize: '14px',
                fontFamily: 'monospace',
                fontStyle: 'bold',
                color: e.side === 'zombie' ? '#ffc494' : '#b8fff2',
                stroke: '#203343',
                strokeThickness: 3,
              })
              .setOrigin(0.5)
              .setDepth(1000),
          );
      }
      this.labels
        .get(e.id)
        ?.setPosition(x, y - 16 - age * 1.1)
        .setAlpha(fade);
      if (e.type === 'hit')
        for (let i = 0; i < 4; i++) {
          g.lineStyle(2, i % 2 ? 0xffcc84 : 0xd5fbff, fade);
          g.lineBetween(
            x + Math.cos(i * 1.6) * age,
            y + Math.sin(i * 1.6) * age,
            x + Math.cos(i * 1.6) * (age + 5),
            y + Math.sin(i * 1.6) * (age + 5),
          );
        }
      if (e.type === 'explosion') {
        g.fillStyle(e.side === 'plant' ? 0xffc779 : 0xf5806c, fade * 0.45);
        g.fillCircle(x, y, 15 + age * 2.5);
        g.lineStyle(3, 0xffe6b5, fade);
        g.strokeCircle(x, y, 12 + age * 3);
      }
      if (e.type === 'death')
        for (let i = 0; i < 7; i++) {
          g.fillStyle(i % 2 ? 0xffb66f : 0x7a9da9, fade);
          g.fillRect(x + Math.cos(i * 0.9) * age * 1.7, y + Math.sin(i * 0.9) * age * 1.2, 4, 3);
        }
      if (e.type === 'reveal' || e.type === 'deploy') {
        g.lineStyle(2, 0x9df2df, fade * 0.7);
        g.strokeEllipse(x, p.y, 22 + age * 2, (8 + age * 0.4) * this.vertical);
      }
      if (e.type === 'core' || e.type === 'win') {
        g.lineStyle(e.type === 'win' ? 6 : 3, 0xffb47b, fade * 0.8);
        g.strokeCircle(
          CORE_POSITION.x,
          (CORE_POSITION.y - 90) * this.vertical,
          20 + age * (e.type === 'win' ? 4 : 2),
        );
      }
    }
    this.seenEvent = Math.max(this.seenEvent, ...s.events.map((e) => e.id));
    for (const [id, label] of this.labels)
      if (!s.events.some((e) => e.id === id)) {
        label.destroy();
        this.labels.delete(id);
      }
    // 中枢仅在受损时显示贴近建筑的小血条，完整状态交给主 HUD。
    if (s.coreHp < RULES.coreHp * 1000 && s.coreHp > 0) {
      const y = CORE_POSITION.y * this.vertical - coreHeight - 10;
      g.fillStyle(0x18232b, 0.8);
      g.fillRect(CORE_POSITION.x - 37, y, 74, 5);
      g.fillStyle(0xffa16d);
      g.fillRect(CORE_POSITION.x - 37, y, Math.max(0, (s.coreHp / (RULES.coreHp * 1000)) * 74), 5);
    }
  }
}
