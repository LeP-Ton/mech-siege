import { ROBOTS, DEFENSES, ROBOT_TYPES } from '../game/config';
import type { DefenseType, RobotType } from '../game/config';
import type { GameMap } from '../game/types';
import { CHALLENGES } from '../game/challenges';
import frameLayout from './frame-layout.json';

export type ActorType = RobotType | DefenseType | 'core';
export type ActorAction = 'idle' | 'move' | 'attack' | 'hit' | 'death';
export interface UnitVisualDefinition {
  src: string;
  columns: number;
  rows: number;
  frameWidth: number;
  frameHeight: number;
  width: number;
  height: number;
  origin: [number, number];
  animations: Record<ActorAction, number[]>;
}
const ROOT = '/assets/mech-siege/';
function visual(
  id: ActorType,
  robot: boolean,
  width: number,
  height: number,
): UnitVisualDefinition {
  return {
    src: `${ROOT}${id}.png`,
    columns: robot ? 4 : 2,
    rows: 2,
    frameWidth: robot ? 384 : 627,
    frameHeight: robot ? 512 : 627,
    width,
    height,
    origin: [0.5, 0.94],
    animations: robot
      ? { idle: [0], move: [1, 2, 3, 4], attack: [0, 5], hit: [6], death: [7] }
      : { idle: [0, 1], move: [0], attack: [2], hit: [3], death: [3] },
  };
}
export const UNIT_VISUALS: Record<ActorType, UnitVisualDefinition> = {
  basic: visual('basic', true, 70, 94),
  armor: visual('armor', true, 78, 104),
  runner: visual('runner', true, 70, 94),
  digger: visual('digger', true, 78, 104),
  bomber: visual('bomber', true, 75, 100),
  commander: visual('commander', true, 74, 99),
  shooter: visual('shooter', false, 76, 76),
  wall: visual('wall', false, 78, 84),
  frost: visual('frost', false, 78, 78),
  flower: visual('flower', false, 74, 74),
  bomb: visual('bomb', false, 68, 68),
  detector: visual('detector', false, 76, 80),
  cannon: visual('cannon', false, 84, 84),
  core: visual('core', false, 180, 232),
};
export function actorPose(type: ActorType, frame = 0, perspective = 1) {
  const visual = UNIT_VISUALS[type];
  const bounds = frameLayout[type][frame];
  // 每帧以真实脚底定位；报废姿态沿用站立比例，避免倒地后被放大。
  const reference = frame === (isRobot(type) ? 7 : -1) ? frameLayout[type][0] : bounds;
  const scale = (visual.height * 0.84 * perspective) / reference.height;
  return {
    width: visual.frameWidth * scale,
    height: visual.frameHeight * scale,
    originX: bounds.pivot,
    originY: (bounds.y + bounds.height) / visual.frameHeight,
  };
}
export const ACTOR_TYPES = Object.keys(UNIT_VISUALS) as ActorType[];
export const HERO_URL = `${ROOT}hero.png`;
export function actorUrl(type: ActorType) {
  return UNIT_VISUALS[type].src;
}
export function actorName(type: ActorType) {
  return type === 'core'
    ? '防御中枢'
    : type in ROBOTS
      ? ROBOTS[type as RobotType].name
      : DEFENSES[type as DefenseType].name;
}
export function isRobot(type: ActorType): type is RobotType {
  return (ROBOT_TYPES as string[]).includes(type);
}
export function environmentIndex(map: GameMap) {
  return CHALLENGES.find((c) => c.seed === map.seed)?.theme ?? map.environment;
}
export function environmentUrl(map: GameMap) {
  return `${ROOT}battlefield-${environmentIndex(map)}.png`;
}
