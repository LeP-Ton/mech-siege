import { describe, it, expect } from 'vitest';
import { robotPose } from './robotPose';
import { PART_ATLASES, BIPED_RIGS } from './rigs';
import { transformPartPoint, rotate } from './bipedPose';
import type { DrawPart, RigAction } from './bipedPose';
import { readAlpha } from './test-support/pngAlpha';

const alpha = readAlpha(`public${PART_ATLASES.armorEquipment.src}`);
function opaqueAt(drawn: DrawPart, pixels = alpha) {
  const axis = drawn.axis ?? Math.PI / 2;
  return (x: number, y: number) => {
    const local = rotate(
      { x: x - drawn.position.x, y: y - drawn.position.y },
      -(drawn.angle + axis - Math.PI / 2),
    );
    const offset = rotate(
      { x: local.x / (drawn.scale * (drawn.widthScale ?? 1)), y: local.y / drawn.scale },
      axis - Math.PI / 2,
    );
    const sourceX = Math.floor(drawn.part.pivot.x + offset.x),
      sourceY = Math.floor(drawn.part.pivot.y + offset.y);
    const [left, top, w, h] = drawn.part.rect;
    return (
      sourceX >= left &&
      sourceX < left + w &&
      sourceY >= top &&
      sourceY < top + h &&
      pixels.at(sourceX, sourceY) >= 64
    );
  };
}

describe('手臂与独立装备装配', () => {
  it('爆破裁去重复肩甲后，前臂在整周期与所有动作过渡中持续接触身体实体', () => {
    const pixels = readAlpha(`public${BIPED_RIGS.bomber.src}`);
    let minimum = Infinity;
    for (const action of ['walk', 'idle', 'hit', 'attack'] as RigAction[])
      for (const weight of [0, 0.5, 1])
        for (const attack of [0, 0.5, 1])
          for (let frame = 0; frame < 64; frame++) {
            const parts = robotPose('bomber', frame / 64, weight, action, 1, {
              attack,
              hit: action === 'hit' ? 1 : 0,
            }).parts;
            const bodyPixel = opaqueAt(parts.find((p) => p.name === 'body')!, pixels);
            for (const name of ['nearArm', 'farArm']) {
              const arm = parts.find((p) => p.name === name)!;
              const armPixel = opaqueAt(arm, pixels);
              let contact = 0;
              for (let y = arm.position.y - 3; y <= arm.position.y + 3; y += 0.5)
                for (let x = arm.position.x - 3; x <= arm.position.x + 3; x += 0.5)
                  if (bodyPixel(x, y) && armPixel(x, y)) contact++;
              minimum = Math.min(minimum, contact);
            }
          }
    expect(minimum).toBeGreaterThan(12);
  });
  it('重装远侧前臂与盾牌的真实不透明像素持续衔接，不只验证两个虚构锚点', () => {
    let smallestContact = Infinity;
    for (const action of ['walk', 'idle', 'hit', 'attack'] as RigAction[])
      for (const weight of [0, 0.5, 1])
        for (let frame = 0; frame < 64; frame++) {
          const parts = robotPose('armor', frame / 64, weight, action).parts;
          const arm = parts.find((p) => p.name === 'farArm')!,
            shield = parts.find((p) => p.name === 'farShield')!;
          const grip = transformPartPoint(arm, {
            x: (arm.part.tip.x - arm.part.pivot.x) / 2,
            y: (arm.part.tip.y - arm.part.pivot.y) / 2,
          });
          const armPixel = opaqueAt(arm),
            shieldPixel = opaqueAt(shield);
          let contact = 0;
          for (let y = grip.y - 8; y <= grip.y + 8; y += 0.5)
            for (let x = grip.x - 8; x <= grip.x + 10; x += 0.5)
              if (armPixel(x, y) && shieldPixel(x, y)) contact++;
          smallestContact = Math.min(smallestContact, contact);
        }
    expect(smallestContact).toBeGreaterThan(8);
  });
  it('盾牌独立定尺寸，实际轮廓达到参考的约三分之二身高并离地', () => {
    const shield = robotPose('armor', 0, 0, 'idle').parts.find((p) => p.name === 'farShield')!;
    let left = Infinity,
      right = -Infinity,
      top = Infinity,
      bottom = -Infinity;
    const [x, y, w, h] = shield.part.rect;
    for (let row = y; row < y + h; row += 2)
      for (let col = x; col < x + w; col += 2)
        if (alpha.at(col, row) >= 64) {
          const p = transformPartPoint(shield, {
            x: col - shield.part.pivot.x,
            y: row - shield.part.pivot.y,
          });
          left = Math.min(left, p.x);
          right = Math.max(right, p.x);
          top = Math.min(top, p.y);
          bottom = Math.max(bottom, p.y);
        }
    expect(bottom - top).toBeGreaterThan(66);
    expect(bottom - top).toBeLessThan(70);
    expect(right - left).toBeGreaterThan(19);
    expect(right - left).toBeLessThan(23);
    expect(top).toBeLessThan(-76);
    expect(bottom).toBeLessThan(-8);
  });
  it('疾行近侧肘部朝后弯、拳面在前，防止再次把相反视角的手臂挂到近侧', () => {
    for (const weight of [0, 1]) {
      const arm = robotPose('runner', 0, weight, 'walk').parts.find((p) => p.name === 'nearArm')!;
      const elbow = transformPartPoint(arm, {
        x: arm.part.elbow!.x - arm.part.pivot.x,
        y: arm.part.elbow!.y - arm.part.pivot.y,
      });
      const hand = transformPartPoint(arm, {
        x: arm.part.tip.x - arm.part.pivot.x,
        y: arm.part.tip.y - arm.part.pivot.y,
      });
      expect(elbow.x).toBeLessThan(arm.position.x - 2);
      expect(elbow.x).toBeLessThan(hand.x - 3);
      expect(elbow.y).toBeGreaterThan(arm.position.y);
      expect(elbow.y).toBeLessThan(hand.y);
    }
  });
});
