import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROBOT_TYPES, ROBOT_RIG_URLS, robotPose, trackPoint } from './robotPose';
import { advanceRobotMotion } from './robotMotion';
import { BIPED_RIGS, partSource } from './rigs';
import { BIPED_PROFILES, robotCycleDistance } from './robotProfiles';
import { gaitPhase } from './gait';

describe('六机体连续动作', () => {
  it('六种机体所有分层部件、轴心都来自完整透明图集', () => {
    for (const type of ROBOT_TYPES)
      for (const { part } of robotPose(type, 0, 1, 'walk').parts) {
        const png = readFileSync(`public${partSource(part, ROBOT_RIG_URLS[type])}`);
        const [x, y, w, h] = part.rect;
        expect(png[25]).toBe(6);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(png.readUInt32BE(16));
        expect(y + h).toBeLessThanOrEqual(png.readUInt32BE(20));
        expect(part.pivot.x).toBeGreaterThanOrEqual(0);
        expect(part.pivot.x).toBeLessThanOrEqual(png.readUInt32BE(16));
        expect(part.pivot.y).toBeGreaterThanOrEqual(0);
        expect(part.pivot.y).toBeLessThanOrEqual(png.readUInt32BE(20));
      }
  });
  it('暂停冻结全部过渡，走停、攻击、受击平滑收敛', () => {
    const initial = { weight: 1, attack: 0, hit: 0 };
    expect(advanceRobotMotion(initial, 'attack', 16, true)).toBe(initial);
    const first = advanceRobotMotion(initial, 'attack', 16, false);
    expect(first.weight).toBeGreaterThan(0.8);
    expect(first.attack).toBeGreaterThan(0);
    expect(first.attack).toBeLessThan(0.3);
    for (const action of ['idle', 'attack', 'hit', 'walk'] as const) {
      let state = initial;
      for (let i = 0; i < 100; i++) state = advanceRobotMotion(state, action, 16, false);
      expect(state).toEqual(advanceRobotMotion(initial, action, 0, true, true));
    }
  });
  it('疾行只吸收身体微震，不交替迈腿摆臂，两轮按前进位移持续滚动', () => {
    let lastNear = 0;
    const reference = robotPose('runner', 0, 1, 'walk');
    for (let i = 0; i <= 200; i++) {
      const distance = (i / 200) * robotCycleDistance('runner');
      const pose = robotPose(
        'runner',
        gaitPhase(distance, 100, 42),
        1,
        'walk',
        1,
        undefined,
        distance,
      );
      expect(pose.mode).toBe('roll');
      const body = pose.parts.find((p) => p.name === 'body')!;
      const referenceBody = reference.parts.find((p) => p.name === 'body')!;
      const vibration = body.position.y - referenceBody.position.y;
      expect(body.position.y).toBeGreaterThanOrEqual(-43.35);
      expect(body.position.y).toBeLessThanOrEqual(-42.65);
      for (const [side, leg] of pose.legs.entries()) {
        expect(leg.ankle).toEqual(reference.legs[side].ankle);
        expect(leg.hip.x).toBeCloseTo(reference.legs[side].hip.x, 8);
        expect(leg.hip.y - reference.legs[side].hip.y).toBeCloseTo(vibration, 8);
        expect(leg.ankle.y).toBe(-11);
        expect(leg.sole.y).toBe(0);
      }
      const near = pose.parts.find((p) => p.name === 'nearFoot')!;
      expect(near.angle * 11).toBeCloseTo(distance, 8);
      for (const name of ['nearArm', 'farArm']) {
        const arm = pose.parts.find((p) => p.name === name)!;
        const referenceArm = reference.parts.find((p) => p.name === name)!;
        expect(arm.angle).toBe(referenceArm.angle);
        expect(arm.position.x).toBe(referenceArm.position.x);
        expect(arm.position.y - referenceArm.position.y).toBeCloseTo(vibration, 8);
      }
      if (i > 0) expect(Math.abs(near.angle - lastNear)).toBeLessThan(0.06);
      lastNear = near.angle;
    }
  });
  it('疾行、掘地身体微震幅度一致，停步收敛后完全静止，循环接缝连续', () => {
    for (const type of ['runner', 'digger'] as const) {
      const body = (phase: number, weight: number) =>
        robotPose(type, phase, weight, 'walk').parts.find((p) => p.name === 'body')!;
      expect(body(0.25, 1).position.y - body(0, 1).position.y).toBeCloseTo(0.7, 8);
      expect(body(0.25, 0)).toEqual(body(0, 0));
      expect(body(0.00001, 1).position.y).toBeCloseTo(body(0.99999, 1).position.y, 8);
    }
  });
  it('全部腿式底盘按远腿、身体、近腿、近臂遮挡，近侧髋部覆盖身体', () => {
    for (const type of ROBOT_TYPES.filter((type) => type !== 'digger'))
      for (const action of ['walk', 'idle', 'attack', 'hit'] as const) {
        const names = robotPose(type, 0.25, 1, action).parts.map((p) => p.name);
        const body = names.indexOf('body');
        for (const name of ['farThigh', 'farShin', 'farFoot'])
          expect(names.indexOf(name)).toBeLessThan(body);
        for (const name of ['nearThigh', 'nearShin', 'nearFoot']) {
          expect(names.indexOf(name)).toBeGreaterThan(body);
          expect(names.indexOf(name)).toBeLessThan(names.indexOf('nearArm'));
        }
      }
  });
  it('履带绕行位置和切线在每个直线、圆弧接缝连续', () => {
    const length = 40 + 2 * Math.PI * 10.2;
    for (const seam of [0, 20, 20 + Math.PI * 10.2, 40 + Math.PI * 10.2, length]) {
      const a = trackPoint(seam - 1e-6),
        b = trackPoint(seam + 1e-6);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.00001);
      expect(Math.cos(a.angle)).toBeCloseTo(Math.cos(b.angle), 5);
      expect(Math.sin(a.angle)).toBeCloseTo(Math.sin(b.angle), 5);
    }
  });
  it('重装盾位于远臂，爆破短腿大靴与长手臂具有独立比例', () => {
    const parts = robotPose('armor', 0, 1, 'walk').parts;
    expect(parts.find((p) => p.name === 'farShield')?.part.texture).toBe('armorEquipment');
    expect(BIPED_RIGS.armor.arms.every((part) => part.texture === 'armorEquipment')).toBe(true);
    expect(BIPED_PROFILES.armor.shinWidth).toBeGreaterThan(1.5);
    expect(BIPED_PROFILES.bomber.hipHeight).toBeLessThan(30);
    expect(BIPED_PROFILES.bomber.soleHeight).toBeGreaterThan(10);
    expect(BIPED_PROFILES.bomber.armLength[1]).toBeGreaterThan(28);
  });
});
