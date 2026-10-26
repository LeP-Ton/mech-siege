import { ROBOT_TYPES } from '../game/config';
import type { RobotType } from '../game/config';
import { BIPED_RIGS, isBiped } from './rigs';
import type { Part } from './rigs';
import { bipedPose, rotate, partLength, actionBlend } from './bipedPose';
import type { DrawPart, RigAction, ActionBlend } from './bipedPose';
import { kneeBetween } from './gait';
import type { Point } from './gait';
import { RUNNER_RIG, DIGGER_RIG } from './mobileRigs';

export { ROBOT_TYPES };
export const ROBOT_RIG_URLS = Object.fromEntries(
  ROBOT_TYPES.map((type) => [
    type,
    isBiped(type) ? BIPED_RIGS[type].src : type === 'runner' ? RUNNER_RIG.src : DIGGER_RIG.src,
  ]),
) as Record<RobotType, string>;
const limbOrder = [
  'farArm',
  'farThigh',
  'farShin',
  'farFoot',
  'body',
  'farShield',
  'nearThigh',
  'nearShin',
  'nearFoot',
  'nearArm',
];

// 轮式、履带机体共用小幅悬挂震颤；位移停止或暂停后相位也停止。
const rollingVibration = (phase: number, weight: number) =>
  -0.35 * Math.cos(phase * Math.PI * 4) * weight;

function runnerPose(phase: number, weight: number, blend: ActionBlend, distance: number) {
  const rig = RUNNER_RIG,
    hipHeight = 43,
    wheelRadius = 11;
  const bodyScale = (100 - hipHeight) / (rig.body.pivot.y - rig.top);
  const body = {
    x: -0.7 * blend.hit,
    y: -hipHeight + rollingVibration(phase, weight),
  };
  const lean = 0.025 * weight + 0.055 * blend.attack;
  const local = (p: Point) => {
    const r = rotate(
      { x: (p.x - rig.body.pivot.x) * bodyScale, y: (p.y - rig.body.pivot.y) * bodyScale },
      lean,
    );
    return { x: body.x + r.x, y: body.y + r.y };
  };
  const parts: DrawPart[] = [];
  const segment = (name: string, part: Part, from: Point, to: Point) => {
    const axis = Math.atan2(part.tip.y - part.pivot.y, part.tip.x - part.pivot.x);
    parts.push({
      name,
      part,
      position: from,
      scale: Math.hypot(to.x - from.x, to.y - from.y) / partLength(part),
      angle: Math.atan2(to.y - from.y, to.x - from.x) - axis,
      axis,
    });
  };
  const legs = [0, 1].map((side) => {
    const prefix = side ? 'near' : 'far';
    const hip = local(rig.hips[side]);
    const ankle = {
      x: (rig.hips[side].x - rig.body.pivot.x) * bodyScale,
      y: -wheelRadius,
    };
    const knee = kneeBetween(hip, ankle, 18, 18);
    segment(`${prefix}Thigh`, rig.thigh, hip, knee);
    segment(`${prefix}Shin`, rig.shin, knee, ankle);
    // 轮轴固定贴地，腿部只吸收身体微震，不交替迈腿或摆臂。
    parts.push({
      name: `${prefix}Foot`,
      part: rig.wheel,
      position: ankle,
      scale: wheelRadius / rig.wheelRadius,
      angle: distance / wheelRadius,
    });
    const arm = rig.arms[side],
      axis = Math.atan2(arm.tip.y - arm.pivot.y, arm.tip.x - arm.pivot.x);
    parts.push({
      name: `${prefix}Arm`,
      part: arm,
      position: local(rig.shoulders[side]),
      scale: 28 / partLength(arm),
      axis,
      angle: Math.PI / 2 - axis - 0.08 * weight - (side ? 1 : 0.2) * blend.attack,
    });
    return {
      hip,
      knee,
      ankle,
      foot: { x: 0, y: 0, angle: 0, planted: true },
      sole: { x: ankle.x, y: 0 },
    };
  });
  parts.push({ name: 'body', part: rig.body, position: body, scale: bodyScale, angle: lean });
  return { parts, legs, legLength: 18, mode: 'roll' as const };
}

// 胶囊形履带周长参数化：上下直线与两端圆弧的切线连续，链节不会在拐角跳动。
export function trackPoint(distance: number, straight = 10, radius = 10.2) {
  const length = straight * 4 + 2 * Math.PI * radius;
  let d = ((distance % length) + length) % length;
  if (d < straight * 2) return { x: -straight + d, y: -radius, angle: 0 };
  d -= straight * 2;
  if (d < Math.PI * radius) {
    const a = -Math.PI / 2 + d / radius;
    return { x: straight + radius * Math.cos(a), y: radius * Math.sin(a), angle: a + Math.PI / 2 };
  }
  d -= Math.PI * radius;
  if (d < straight * 2) return { x: straight - d, y: radius, angle: Math.PI };
  d -= straight * 2;
  const a = Math.PI / 2 + d / radius;
  return { x: -straight + radius * Math.cos(a), y: radius * Math.sin(a), angle: a + Math.PI / 2 };
}
function diggerPose(phase: number, weight: number, blend: ActionBlend, distance: number) {
  const rig = DIGGER_RIG;
  const scale = 72 / (rig.body.pivot.y - rig.top);
  const body = { x: -0.8 * blend.hit, y: -28 + rollingVibration(phase, weight) };
  const parts: DrawPart[] = [];
  const add = (
    name: string,
    part: Part,
    position: Point,
    scale: number,
    angle = 0,
    widthScale = 1,
  ) => parts.push({ name, part, position, scale, angle, widthScale });
  const track = (prefix: string, x: number, size: number) => {
    const centerY = -12.3 * size;
    add(
      `${prefix}Track`,
      rig.track,
      { x, y: centerY },
      (20 / 377) * size,
      0,
      (44 * 377) / (20 * 1220),
    );
    // 两端驱动轮与中部托轮均在同一侧视平面，轴心固定，轮面在底板内旋转。
    for (const [i, offset] of [-12, 0, 12].entries()) {
      const radius = i === 1 ? 5.2 : 8.3;
      add(
        `${prefix}Wheel${i}`,
        rig.wheel,
        { x: x + offset * size, y: centerY },
        (radius / 218) * size,
        distance / radius,
        436 / 444,
      );
    }
    const length = 48 + 2 * Math.PI * 10;
    for (let i = 0; i < 28; i++) {
      const point = trackPoint((i * length) / 28 + distance, 12, 10);
      // 链节实际轮廓沿同一底板外缘闭合；只保留这一圈，底板不再带静态轮组。
      add(
        `${prefix}Tread${i}`,
        rig.link,
        { x: x + point.x * size, y: centerY + point.y * size },
        (4 / 202) * size,
        point.angle,
        (4.55 * 202) / (4 * 503),
      );
    }
  };
  track('far', 16, 0.78);
  const farArm = rig.arms[0];
  add(
    'farArm',
    farArm,
    {
      x: body.x + (rig.shoulders[0].x - 300) * scale,
      y: body.y + (rig.shoulders[0].y - 520) * scale,
    },
    30 / partLength(farArm),
    -0.15 + 0.05 * Math.sin(phase * Math.PI * 2) * weight - 0.2 * blend.attack,
  );
  add('body', rig.body, body, scale, 0.015 * blend.attack);
  track('near', -6, 1);
  add(
    'nearArm',
    rig.arms[1],
    {
      x: body.x + (rig.shoulders[1].x - 300) * scale + 2 * blend.attack,
      y: body.y + (rig.shoulders[1].y - 520) * scale,
    },
    43 / partLength(rig.arms[1]),
    -0.025 + 0.018 * Math.sin(phase * Math.PI * 2) * weight - 0.12 * blend.attack,
  );
  return { parts, legs: [], legLength: 0, mode: 'track' as const };
}
export function robotPose(
  type: RobotType,
  phase: number,
  weight: number,
  action: RigAction,
  pulse = 1,
  blend = actionBlend(action, pulse),
  distance = 0,
) {
  if (type === 'digger') return diggerPose(phase, weight, blend, distance);
  const pose =
    type === 'runner'
      ? runnerPose(phase, weight, blend, distance)
      : { ...bipedPose(type, phase, weight, action, pulse, blend), mode: 'walk' as const };
  pose.parts.sort((a, b) => limbOrder.indexOf(a.name) - limbOrder.indexOf(b.name));
  return pose;
}
