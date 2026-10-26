import { STANCE } from './gait';
import type { BipedType } from './rigs';
import type { RobotType } from '../game/config';

export interface BipedProfile {
  hipHeight: number;
  upper: number;
  lower: number;
  soleHeight: number;
  stride: number;
  lift: number;
  thighWidth: number;
  shinWidth: number;
  footWidth: number;
  armLength: [number, number];
  armWidth: number | [number, number];
}
const standard: BipedProfile = {
  hipHeight: 38,
  upper: 18,
  lower: 18,
  soleHeight: 7,
  stride: 30,
  lift: 7,
  thighWidth: 1,
  shinWidth: 1,
  footWidth: 1,
  armLength: [28, 28],
  armWidth: 1,
};
// 比例来自各机体参考：重装宽厚，爆破大肚短腿，不能统一套用先锋的骨长。
export const BIPED_PROFILES: Record<BipedType, BipedProfile> = {
  basic: { ...standard },
  armor: {
    ...standard,
    hipHeight: 32,
    upper: 12.5,
    lower: 12.5,
    soleHeight: 10.5,
    stride: 17,
    lift: 4,
    thighWidth: 1.7,
    shinWidth: 2,
    footWidth: 1.15,
    armLength: [18, 31.5],
    armWidth: [1.4, 1.05],
  },
  bomber: {
    ...standard,
    hipHeight: 27,
    upper: 10,
    lower: 10,
    soleHeight: 11,
    stride: 11.5,
    lift: 3.2,
    thighWidth: 1.65,
    shinWidth: 1.8,
    footWidth: 1.05,
    armLength: [25.3, 29.3],
    armWidth: 1.12,
  },
  commander: { ...standard },
};
export function robotCycleDistance(type: RobotType) {
  if (type === 'runner') return 42;
  if (type === 'digger') return 48;
  return BIPED_PROFILES[type].stride / STANCE;
}
