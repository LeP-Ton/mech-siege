// 步态只读取表现层位移，不参与模拟、随机数或回放序列化。
export const STRIDE = 30;
export const STANCE = 0.62;
export const LEG_LENGTH = 18;
export const HIP_HEIGHT = 38;
export const SOLE_HEIGHT = 7;
export const FOOT_LIFT = 7;
export interface Point {
  x: number;
  y: number;
}
export interface FootPose extends Point {
  angle: number;
  planted: boolean;
}
export function cycle(value: number) {
  return ((value % 1) + 1) % 1;
}

export function footPose(phase: number, weight = 1, stride = STRIDE, lift = FOOT_LIFT): FootPose {
  const p = cycle(phase);
  if (p < STANCE)
    return {
      x: stride * (0.5 - p / STANCE) * weight,
      y: 0,
      angle: 0,
      planted: true,
    };
  const t = (p - STANCE) / (1 - STANCE);
  // 摆动段两端接上支撑段速度，脚先蹬离地面再向前摆，不在接缝突然反向。
  const tangent = (-stride * (1 - STANCE)) / STANCE;
  const x =
    ((2 * t ** 3 - 3 * t ** 2 + 1) * -stride) / 2 +
    (t ** 3 - 2 * t ** 2 + t) * tangent +
    ((-2 * t ** 3 + 3 * t ** 2) * stride) / 2 +
    (t ** 3 - t ** 2) * tangent;
  return {
    x: x * weight,
    y: -lift * Math.sin(Math.PI * t) ** 2 * weight,
    angle: 0.16 * Math.sin(2 * Math.PI * t) * Math.sin(Math.PI * t) ** 2 * weight,
    planted: false,
  };
}

export function kneeBetween(hip: Point, ankle: Point, upper = LEG_LENGTH, lower = upper): Point {
  const dx = ankle.x - hip.x,
    dy = ankle.y - hip.y;
  const actual = Math.hypot(dx, dy);
  const d = Math.min(upper + lower - 0.001, Math.max(Math.abs(upper - lower) + 0.001, actual));
  const ux = dx / (actual || 1),
    uy = dy / (actual || 1);
  const along = (upper ** 2 - lower ** 2 + d ** 2) / (2 * d);
  const bend = Math.sqrt(Math.max(0, upper ** 2 - along ** 2));
  return { x: hip.x + ux * along + uy * bend, y: hip.y + uy * along - ux * bend };
}

export function legPose(
  phase: number,
  weight: number,
  hip: Point,
  soleHeight: number,
  groundY: number,
  groundX = 0,
  geometry = { stride: STRIDE, lift: FOOT_LIFT, upper: LEG_LENGTH, lower: LEG_LENGTH },
) {
  const foot = footPose(phase, weight, geometry.stride, geometry.lift);
  const ankle = {
    x: groundX + foot.x + Math.sin(foot.angle) * soleHeight,
    y: foot.y + groundY - Math.cos(foot.angle) * soleHeight,
  };
  return { foot, ankle, knee: kneeBetween(hip, ankle, geometry.upper, geometry.lower) };
}

// 一个循环前进 STRIDE / STANCE，支撑段脚向后等速抵消机体向前移动。
export const CYCLE_DISTANCE = STRIDE / STANCE;
export function gaitPhase(distance: number, height: number, cycleDistance = CYCLE_DISTANCE) {
  return cycle(distance / ((height / 100) * cycleDistance));
}
