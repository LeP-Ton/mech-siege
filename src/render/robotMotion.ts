import type { RigAction, ActionBlend } from './bipedPose';
import { actionBlend } from './bipedPose';

export interface RobotMotion extends ActionBlend {
  weight: number;
}
const ease = (from: number, to: number, delta: number, duration: number) => {
  const value = from + (to - from) * (1 - Math.exp(-Math.min(delta, 100) / duration));
  return Math.abs(value - to) < 0.002 ? to : value;
};
// 六种机体共享同一个过渡时钟；暂停冻结全部权重，逐相位检查才显式跳至目标。
export function advanceRobotMotion(
  previous: RobotMotion,
  action: RigAction,
  delta: number,
  frozen: boolean,
  snap = false,
  pulse = 1,
): RobotMotion {
  const target = {
    weight: action === 'walk' || action === 'hit' ? 1 : 0,
    ...actionBlend(action, pulse),
  };
  if (snap) return target;
  if (frozen) return previous;
  return {
    weight: ease(previous.weight, target.weight, delta, 90),
    attack: ease(previous.attack, target.attack, delta, 65),
    hit: ease(previous.hit, target.hit, delta, 45),
  };
}
