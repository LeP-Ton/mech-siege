import { describe, expect, it } from 'vitest';
import { robotPose, trackPoint } from './robotPose';
import { PART_ATLASES } from './rigs';
import { rotate, transformPartPoint } from './bipedPose';
import type { DrawPart } from './bipedPose';
import { readAlpha } from './test-support/pngAlpha';

const pixels = readAlpha(`public${PART_ATLASES.diggerGear.src}`);
function opaqueAt(drawn: DrawPart, x: number, y: number) {
  const local = rotate({ x: x - drawn.position.x, y: y - drawn.position.y }, -drawn.angle);
  const col = Math.floor(drawn.part.pivot.x + local.x / (drawn.scale * (drawn.widthScale ?? 1))),
    row = Math.floor(drawn.part.pivot.y + local.y / drawn.scale);
  const [left, top, width, height] = drawn.part.rect;
  return (
    col >= left &&
    col < left + width &&
    row >= top &&
    row < top + height &&
    pixels.at(col, row) >= 64
  );
}

describe('履带实际像素装配', () => {
  it('整圈真实链节连续覆盖轨迹，闭合处没有断带或漂出底盘的叠片', () => {
    const length = 48 + 2 * Math.PI * 10;
    let uncovered = 0,
      largestRadius = 0,
      deepest = -Infinity,
      highestContact = Infinity;
    for (let frame = 0; frame < 96; frame++) {
      const parts = robotPose(
        'digger',
        frame / 96,
        1,
        'walk',
        1,
        undefined,
        (frame * length) / 96,
      ).parts;
      for (const [prefix, size, x] of [
        ['near', 1, -6],
        ['far', 0.78, 16],
      ] as const) {
        const links = parts.filter((p) => p.name.startsWith(`${prefix}Tread`));
        for (let sample = 0; sample < 224; sample++) {
          const point = trackPoint((sample * length) / 224, 12, 10);
          if (!links.some((link) => opaqueAt(link, x + point.x * size, (-12.3 + point.y) * size)))
            uncovered++;
        }
        let lowest = -Infinity;
        for (const link of links) {
          const [left, top, width, height] = link.part.rect;
          for (let row = top; row < top + height; row += 8)
            for (let col = left; col < left + width; col += 8)
              if (pixels.at(col, row) >= 64) {
                const p = transformPartPoint(link, {
                  x: col - link.part.pivot.x,
                  y: row - link.part.pivot.y,
                });
                const radial = Math.hypot(
                  Math.max(0, Math.abs((p.x - x) / size) - 12),
                  p.y / size + 12.3,
                );
                largestRadius = Math.max(largestRadius, radial);
                lowest = Math.max(lowest, p.y);
              }
        }
        deepest = Math.max(deepest, lowest);
        highestContact = Math.min(highestContact, lowest);
      }
    }
    expect(uncovered).toBe(0);
    expect(largestRadius).toBeLessThan(12.31);
    expect(deepest).toBeLessThanOrEqual(0.05);
    expect(highestContact).toBeGreaterThan(-0.5);
  });
  it('车轮真实圆面始终位于底板轮廓内，旋转时不跳轴或切出履带', () => {
    let outside = 0;
    for (let frame = 0; frame < 32; frame++) {
      const parts = robotPose('digger', 0, 1, 'walk', 1, undefined, frame * 2).parts;
      for (const prefix of ['near', 'far']) {
        const plate = parts.find((p) => p.name === `${prefix}Track`)!;
        for (const wheel of parts.filter((p) => p.name.startsWith(`${prefix}Wheel`))) {
          const [left, top, width, height] = wheel.part.rect;
          for (let row = top; row < top + height; row += 12)
            for (let col = left; col < left + width; col += 12)
              if (pixels.at(col, row) >= 64) {
                const p = transformPartPoint(wheel, {
                  x: col - wheel.part.pivot.x,
                  y: row - wheel.part.pivot.y,
                });
                if (!opaqueAt(plate, p.x, p.y)) outside++;
              }
        }
      }
    }
    expect(outside).toBe(0);
  });
});
