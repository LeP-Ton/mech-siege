import { describe, expect, it } from 'vitest';
import { BIPED_TYPES, LEG_ATLAS_URL } from './rigs';
import type { Part } from './rigs';
import { bipedPose, transformPartPoint } from './bipedPose';
import type { RigAction } from './bipedPose';

import { readAlpha } from './test-support/pngAlpha';

const alpha = readAlpha(`public${LEG_ATLAS_URL}`);
const outlineCache = new Map<Part, [number, number][]>();
function outline(part: Part) {
  let points = outlineCache.get(part);
  if (points) return points;
  points = [];
  const [x, y, w, h] = part.rect;
  for (let row = y; row < y + h; row++) {
    let left = -1,
      right = -1;
    for (let col = x; col < x + w; col++)
      if (alpha.at(col, row) >= 32) {
        if (left < 0) left = col;
        right = col;
      }
    if (left >= 0)
      points.push(
        [left + 0.5 - part.pivot.x, row + 0.5 - part.pivot.y],
        [right + 0.5 - part.pivot.x, row + 0.5 - part.pivot.y],
      );
  }
  outlineCache.set(part, points);
  return points;
}

describe('腿部真实像素轮廓', () => {
  it('四种机体整周期与动作过渡中没有腿段、鞋尖或残片穿过地面', () => {
    let worst = { value: -Infinity, type: '', part: '', phase: 0 };
    for (const type of BIPED_TYPES)
      for (const action of ['walk', 'idle', 'hit', 'attack'] as RigAction[])
        for (const weight of [0, 0.25, 0.5, 0.75, 1])
          for (let frame = 0; frame < 64; frame++) {
            for (const drawn of bipedPose(type, frame / 64, weight, action).parts) {
              if (drawn.part.texture !== 'legs') continue;
              let bottom = -Infinity;
              for (const [x, y] of outline(drawn.part))
                bottom = Math.max(bottom, transformPartPoint(drawn, { x, y }).y);
              if (bottom > worst.value)
                worst = { value: bottom, type, part: drawn.name, phase: frame / 64 };
            }
          }
    expect(worst, JSON.stringify(worst)).toMatchObject({ value: expect.any(Number) });
    expect(worst.value, JSON.stringify(worst)).toBeLessThan(0.15);
  });
  it('支撑脚的真实鞋底落在地面上，不以虚构锚点掩盖悬空', () => {
    for (const type of BIPED_TYPES)
      for (let frame = 0; frame < 64; frame++) {
        const pose = bipedPose(type, frame / 64, 1, 'walk');
        for (let side = 0; side < 2; side++)
          if (pose.legs[side].foot.planted) {
            const foot = pose.parts.find((p) => p.name === (side ? 'nearFoot' : 'farFoot'))!;
            const bottom = Math.max(
              ...outline(foot.part).map(([, y]) => foot.position.y + y * foot.scale),
            );
            expect(bottom, `${type} ${frame} ${side}`).toBeGreaterThan(-0.15);
            expect(bottom).toBeLessThan(0.15);
          }
      }
  });
  it('独立腿段四边留有透明间隔，没有来自相邻部件的裁切碎片', () => {
    const checked = new Set<Part>();
    for (const type of BIPED_TYPES)
      for (const { part } of bipedPose(type, 0, 1, 'walk').parts) {
        if (part.texture !== 'legs' || checked.has(part)) continue;
        checked.add(part);
        const [x, y, w, h] = part.rect;
        for (let col = x; col < x + w; col++) {
          expect(alpha.at(col, y)).toBeLessThan(32);
          expect(alpha.at(col, y + h - 1)).toBeLessThan(32);
        }
        for (let row = y; row < y + h; row++) {
          expect(alpha.at(x, row)).toBeLessThan(32);
          expect(alpha.at(x + w - 1, row)).toBeLessThan(32);
        }
      }
  });
});
