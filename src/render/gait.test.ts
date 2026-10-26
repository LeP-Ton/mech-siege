import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cycle, footPose, gaitPhase, CYCLE_DISTANCE, STANCE, FOOT_LIFT } from './gait';
import { BIPED_RIGS, BIPED_TYPES, partSource } from './rigs';
import { bipedPose, transformPartPoint } from './bipedPose';
import { BIPED_PROFILES } from './robotProfiles';

describe('连续双足步态', () => {
  it('左右脚相差半周期，轮流抬起且始终至少一脚支撑', () => {
    let nearLifts = 0,
      farLifts = 0;
    for (let i = 0; i < 1000; i++) {
      const near = footPose(i / 1000),
        far = footPose(i / 1000 + 0.5);
      expect(near.planted || far.planted).toBe(true);
      if (near.y < -1) nearLifts++;
      if (far.y < -1) farLifts++;
    }
    expect(nearLifts).toBeGreaterThan(200);
    expect(nearLifts).toBe(farLifts);
    expect(footPose(0.81).y).toBeCloseTo(-FOOT_LIFT);
    expect(footPose(0.31).y).toBe(0);
    expect(footPose(0.81 + 0.5).y).toBe(0);
  });
  it('支撑脚抵消角色前进位移，避免地面滑步', () => {
    for (const height of [40, 80, 120]) {
      const scale = height / 100;
      const world = (p: number) => p * CYCLE_DISTANCE * scale + footPose(p).x * scale;
      expect(world(0.02)).toBeCloseTo(world(STANCE - 0.02), 8);
    }
  });
  it('落脚、离地与循环接缝的位置及速度连续', () => {
    const e = 0.00001;
    for (const seam of [0, STANCE, 1]) {
      const a = footPose(seam - e),
        b = footPose(seam),
        c = footPose(seam + e);
      expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeLessThan(0.002);
      expect(Math.abs((b.x - a.x) / e - (c.x - b.x) / e)).toBeLessThan(0.03);
      expect(Math.abs((b.y - a.y) / e - (c.y - b.y) / e)).toBeLessThan(0.03);
      expect(Math.abs(a.angle - c.angle)).toBeLessThan(0.001);
    }
  });
  it('减速只降低循环推进速度，停止位移保持同一姿态', () => {
    expect(gaitPhase(CYCLE_DISTANCE, 100)).toBeCloseTo(0);
    expect(gaitPhase(CYCLE_DISTANCE * 0.55, 100)).toBeCloseTo(0.55);
    expect(gaitPhase(CYCLE_DISTANCE * 0.5, 100)).toBeCloseTo(0.5);
    const stopped = footPose(0.81, 0);
    expect(stopped.x).toBeCloseTo(0);
    expect(stopped.y).toBeCloseTo(0);
    expect(stopped.angle).toBeCloseTo(0);
    expect(cycle(-0.25)).toBe(0.75);
  });
  it('膝关节连接两段定长腿，整轮均可到达脚踝且无翻折', () => {
    for (const type of BIPED_TYPES)
      for (let i = 0; i < 1000; i++) {
        for (const { hip, ankle, knee } of bipedPose(type, i / 1000, 1, 'walk').legs) {
          expect(Math.hypot(knee.x - hip.x, knee.y - hip.y)).toBeCloseTo(
            BIPED_PROFILES[type].upper,
            6,
          );
          expect(Math.hypot(knee.x - ankle.x, knee.y - ankle.y)).toBeCloseTo(
            BIPED_PROFILES[type].lower,
            6,
          );
          expect(knee.x).toBeGreaterThan(Math.min(hip.x, ankle.x));
        }
      }
  });
  it('加粗只发生在骨轴横向，所有膝踝圆轴仍准确接合', () => {
    for (const type of BIPED_TYPES)
      for (let i = 0; i < 64; i++) {
        const pose = bipedPose(type, i / 64, 1, 'walk');
        for (let side = 0; side < 2; side++) {
          const leg = pose.legs[side];
          for (const [name, joint] of [
            [`${side ? 'near' : 'far'}Thigh`, leg.knee],
            [`${side ? 'near' : 'far'}Shin`, leg.ankle],
          ] as const) {
            const drawn = pose.parts.find((p) => p.name === name)!;
            const tip = transformPartPoint(drawn, {
              x: drawn.part.tip.x - drawn.part.pivot.x,
              y: drawn.part.tip.y - drawn.part.pivot.y,
            });
            expect(tip.x).toBeCloseTo(joint.x, 8);
            expect(tip.y).toBeCloseTo(joint.y, 8);
          }
        }
      }
  });
  it('四套原始透明图存在，所有分片及关节都在素材范围内', () => {
    for (const rig of Object.values(BIPED_RIGS)) {
      for (const part of [rig.body, ...rig.arms, ...rig.thighs, ...rig.shins, ...rig.feet]) {
        const png = readFileSync(`public${partSource(part, rig.src)}`);
        const width = png.readUInt32BE(16),
          height = png.readUInt32BE(20);
        expect(png[25]).toBe(6);
        const [x, y, w, h] = part.rect;
        expect(x + w).toBeLessThanOrEqual(width);
        expect(y + h).toBeLessThanOrEqual(height);
        expect(part.pivot.x).toBeGreaterThanOrEqual(0);
        expect(part.pivot.x).toBeLessThanOrEqual(width);
        expect(part.pivot.y).toBeGreaterThanOrEqual(0);
        expect(part.pivot.y).toBeLessThanOrEqual(height);
      }
    }
  });
});
