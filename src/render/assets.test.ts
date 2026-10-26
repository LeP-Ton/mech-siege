import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { ACTOR_TYPES, UNIT_VISUALS } from './art';
describe('原创美术资产清单', () => {
  it('所有角色精灵表存在、含透明通道且帧尺寸精确匹配', () => {
    expect(ACTOR_TYPES).toHaveLength(14);
    for (const id of ACTOR_TYPES) {
      const v = UNIT_VISUALS[id];
      const png = readFileSync(`public${v.src}`);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(v.frameWidth * v.columns);
      expect(png.readUInt32BE(20)).toBe(v.frameHeight * v.rows);
      expect(png[25], `${id} 应保留透明通道`).toBe(6);
      const chunks: Buffer[] = [];
      for (let pos = 8; pos < png.length; ) {
        const length = png.readUInt32BE(pos);
        if (png.subarray(pos + 4, pos + 8).toString() === 'IDAT')
          chunks.push(png.subarray(pos + 8, pos + 8 + length));
        pos += length + 12;
      }
      // 第一行首像素的 PNG 预测器初值均为零，可直接验证其真实 Alpha。
      expect(inflateSync(Buffer.concat(chunks))[4], `${id} 背景角必须真实透明`).toBe(0);
      for (const frames of Object.values(v.animations))
        for (const frame of frames) {
          expect(frame).toBeGreaterThanOrEqual(0);
          expect(frame).toBeLessThan(v.columns * v.rows);
        }
    }
  });
  it('新版五战区、原版环境与首页主视觉均为有效本地 PNG', () => {
    for (const name of [
      'hero',
      ...Array.from({ length: 5 }, (_, i) => `environment-${i}`),
      ...Array.from({ length: 5 }, (_, i) => `battlefield-${i}`),
    ]) {
      const png = readFileSync(`public/assets/mech-siege/${name}.png`);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1200);
    }
  });
});
