export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normalizeSeed(input: string): string {
  // 持久化身份保持原值，确保旧布局、纪录键和回放指纹不变。
  const seed = input
    .trim()
    .toUpperCase()
    .replace(/^MS-G1-/, 'ZVP-G1-');
  if (!/^ZVP-G1-[A-Z0-9]{6,12}$/.test(seed))
    throw new Error('请输入有效种子，例如 MS-G1-7J2K9Q（6–12 位字母或数字）。');
  return seed;
}
export function formatSeed(input: string): string {
  return normalizeSeed(input).replace(/^ZVP-G1-/, 'MS-G1-');
}
export function newSeed(): string {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return `MS-G1-${values[0].toString(36).padStart(7, '0').toUpperCase()}${values[1].toString(36).slice(0, 2).toUpperCase()}`;
}
