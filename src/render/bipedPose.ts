import { BIPED_RIGS } from './rigs';
import type { BipedType, Part } from './rigs';
import { cycle, legPose } from './gait';
import type { Point } from './gait';
import { BIPED_PROFILES } from './robotProfiles';

export type RigAction = 'walk' | 'idle' | 'attack' | 'hit';
export interface DrawPart {
  name: string;
  part: Part;
  position: Point;
  scale: number;
  angle: number;
  widthScale?: number;
  axis?: number;
}
export interface ActionBlend {
  attack: number;
  hit: number;
}
export const partLength = (part: Part) =>
  Math.hypot(part.tip.x - part.pivot.x, part.tip.y - part.pivot.y);
export const rotate = (p: Point, angle: number): Point => ({
  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});
// 先把素材骨轴摆正，再沿垂直骨轴加粗，末端关节不会因斜轴缩放发生漂移。
export function transformPartPoint(drawn: DrawPart, point: Point): Point {
  const axis = drawn.axis ?? Math.PI / 2;
  const aligned = rotate(point, Math.PI / 2 - axis);
  const scaled = {
    x: aligned.x * drawn.scale * (drawn.widthScale ?? 1),
    y: aligned.y * drawn.scale,
  };
  const offset = rotate(scaled, drawn.angle + axis - Math.PI / 2);
  return { x: drawn.position.x + offset.x, y: drawn.position.y + offset.y };
}
export function actionBlend(action: RigAction, pulse = 1): ActionBlend {
  return { attack: action === 'attack' ? pulse : 0, hit: action === 'hit' ? 1 : 0 };
}

// 同一份姿态同时驱动真实绘制、关节检查和素材轮廓测试，避免验收只覆盖脚底轨迹。
export function bipedPose(
  type: BipedType,
  phase: number,
  weight: number,
  action: RigAction,
  attackPulse = 1,
  blend = actionBlend(action, attackPulse),
) {
  const rig = BIPED_RIGS[type];
  const profile = BIPED_PROFILES[type];
  const bodyScale = (100 - profile.hipHeight) / (rig.body.pivot.y - rig.top);
  const body = {
    x: -0.7 * blend.hit,
    y: -profile.hipHeight - 0.45 * Math.cos(phase * Math.PI * 4) * weight,
  };
  const lean = 0.035 * blend.attack + 0.008 * weight;
  const local = (p: Point) => {
    const offset = rotate(
      { x: (p.x - rig.body.pivot.x) * bodyScale, y: (p.y - rig.body.pivot.y) * bodyScale },
      lean,
    );
    return { x: body.x + offset.x, y: body.y + offset.y };
  };
  const parts: DrawPart[] = [];
  const add = (
    name: string,
    part: Part,
    position: Point,
    scale: number,
    angle = 0,
    widthScale = 1,
    axis = Math.PI / 2,
  ) => parts.push({ name, part, position, scale, angle, widthScale, axis });
  const segment = (name: string, part: Part, from: Point, to: Point, width: number) => {
    const axis = Math.atan2(part.tip.y - part.pivot.y, part.tip.x - part.pivot.x);
    add(
      name,
      part,
      from,
      Math.hypot(to.x - from.x, to.y - from.y) / partLength(part),
      Math.atan2(to.y - from.y, to.x - from.x) - axis,
      width,
      axis,
    );
  };
  const legs = [0, 1].map((side) => {
    const prefix = side ? 'near' : 'far';
    const hip = local(rig.hips[side]);
    const groundX = (rig.hips[side].x - rig.body.pivot.x) * bodyScale;
    const groundY = 0;
    const { foot, ankle, knee } = legPose(
      cycle(phase + (side ? 0 : 0.5)),
      weight,
      hip,
      profile.soleHeight,
      groundY,
      groundX,
      profile,
    );
    segment(`${prefix}Thigh`, rig.thighs[side], hip, knee, profile.thighWidth);
    segment(`${prefix}Shin`, rig.shins[side], knee, ankle, profile.shinWidth);
    // 脚掌有独立物理高度，不继承小腿贴图缩放；支撑时其真实轮廓落在地面上。
    add(
      `${prefix}Foot`,
      rig.feet[side],
      ankle,
      profile.soleHeight / (rig.soles[side] - rig.feet[side].pivot.y),
      foot.angle,
      profile.footWidth,
    );
    const arm = rig.arms[side];
    const axis = Math.atan2(arm.tip.y - arm.pivot.y, arm.tip.x - arm.pivot.x);
    const rest = Math.PI / 2 - axis;
    const shield = type === 'armor' && side === 0;
    const swing =
      (foot.x / (profile.stride / 2)) * (shield ? 0.025 : type === 'armor' ? 0.16 : 0.24);
    add(
      `${prefix}Arm`,
      arm,
      local(rig.shoulders[side]),
      profile.armLength[side] / partLength(arm),
      rest + swing - (shield ? 0.22 : 0) - (side ? 0.85 : shield ? 0.12 : 0.25) * blend.attack,
      Array.isArray(profile.armWidth) ? profile.armWidth[side] : profile.armWidth,
      axis,
    );
    return { hip, knee, ankle, foot, sole: { x: groundX + foot.x, y: groundY + foot.y } };
  });
  add('body', rig.body, body, bodyScale, lean);
  if (rig.shield) {
    const shield = rig.shield,
      arm = parts.find((p) => p.name === 'farArm')!;
    const grip = transformPartPoint(arm, {
      x: (arm.part.tip.x - arm.part.pivot.x) * shield.gripFraction,
      y: (arm.part.tip.y - arm.part.pivot.y) * shield.gripFraction,
    });
    const angle = arm.angle + (arm.axis ?? Math.PI / 2) - Math.PI / 2 + shield.angleOffset;
    const offset = rotate(shield.offset, angle);
    add(
      'farShield',
      shield.part,
      { x: grip.x + offset.x, y: grip.y + offset.y },
      shield.height / shield.pixelHeight,
      angle,
      shield.widthScale,
    );
  }
  return { parts, legs, legLength: profile.upper };
}
