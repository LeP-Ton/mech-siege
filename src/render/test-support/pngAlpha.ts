import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// 解码真实素材的 Alpha，验证最终绘制轮廓，防止只有骨骼测试通过而鞋尖残片仍穿地。
export function readAlpha(path: string) {
  const png = readFileSync(path),
    width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6) throw new Error('轮廓验收要求 8 位 RGBA PNG');
  const chunks: Buffer[] = [];
  for (let pos = 8; pos < png.length; ) {
    const length = png.readUInt32BE(pos);
    if (png.subarray(pos + 4, pos + 8).toString() === 'IDAT')
      chunks.push(png.subarray(pos + 8, pos + 8 + length));
    pos += length + 12;
  }
  const encoded = inflateSync(Buffer.concat(chunks)),
    stride = width * 4;
  const pixels = new Uint8Array(stride * height);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c,
      da = Math.abs(p - a),
      db = Math.abs(p - b),
      dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = encoded[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const left = x >= 4 ? pixels[i - 4] : 0,
        up = y ? pixels[i - stride] : 0;
      const diagonal = y && x >= 4 ? pixels[i - stride - 4] : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? Math.floor((left + up) / 2)
                : paeth(left, up, diagonal);
      pixels[i] = (encoded[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return {
    width,
    height,
    at: (x: number, y: number) =>
      x >= 0 && y >= 0 && x < width && y < height ? pixels[(y * width + x) * 4 + 3] : 0,
  };
}
