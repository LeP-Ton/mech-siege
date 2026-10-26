import type { Point } from './gait';
export const BIPED_TYPES = ['basic', 'armor', 'bomber', 'commander'] as const;
export type BipedType = (typeof BIPED_TYPES)[number];
export type Rect = [number, number, number, number];
export interface Part {
  rect: Rect;
  // 去除身体已包含的肩甲时，旋转轴保留在原肩中心，可以位于裁片外。
  pivot: Point;
  tip: Point;
  elbow?: Point;
  texture?: 'legs' | 'armorEquipment' | 'diggerGear';
}
export const LEG_ATLAS_URL = '/assets/mech-siege/robot-legs-v2.png';
export const PART_ATLASES = {
  legs: { key: 'robot-legs-v2', src: LEG_ATLAS_URL },
  armorEquipment: { key: 'armor-equipment-v2', src: '/assets/mech-siege/armor-equipment-v2.png' },
  diggerGear: {
    key: 'digger-running-gear-v2',
    src: '/assets/mech-siege/digger-running-gear-v2.png',
  },
};
export function partSource(part: Part, fallback: string) {
  return part.texture ? PART_ATLASES[part.texture].src : fallback;
}
export interface RigDefinition {
  src: string;
  top: number;
  body: Part;
  hips: [Point, Point];
  shoulders: [Point, Point];
  arms: [Part, Part];
  thighs: [Part, Part];
  shins: [Part, Part];
  feet: [Part, Part];
  soles: [number, number];
  shield?: {
    part: Part;
    pixelHeight: number;
    height: number;
    widthScale: number;
    gripFraction: number;
    offset: Point;
    angleOffset: number;
  };
}
const point = (x: number, y: number): Point => ({ x, y });
const part = (rect: Rect, start: [number, number], end = start): Part => ({
  rect,
  pivot: point(...start),
  tip: point(...end),
});
interface LegParts {
  thigh: Part;
  shin: Part;
  foot: Part;
  sole: number;
}
function legParts(
  rects: [Rect, Rect, Rect],
  hip: [number, number],
  knee: [number, number],
  shinKnee: [number, number],
  ankle: [number, number],
  footAnkle: [number, number],
  sole: number,
): LegParts {
  const isolated = (column: number, start: [number, number], end = start): Part => ({
    ...part(rects[column], start, end),
    texture: 'legs',
  });
  return {
    thigh: isolated(0, hip, knee),
    shin: isolated(1, shinKnee, ankle),
    foot: isolated(2, footAnkle),
    sole,
  };
}
const LEGS = [
  legParts(
    [
      [112, 12, 173, 322],
      [461, 9, 165, 325],
      [775, 140, 248, 188],
    ],
    [191, 80],
    [159, 287],
    [520, 80],
    [584, 283],
    [827, 205],
    322,
  ),
  legParts(
    [
      [102, 340, 203, 354],
      [453, 338, 179, 359],
      [755, 473, 296, 206],
    ],
    [160, 428],
    [157, 644],
    [549, 394],
    [597, 645],
    [816, 545],
    673,
  ),
  legParts(
    [
      [75, 700, 242, 346],
      [457, 703, 193, 344],
      [755, 815, 278, 211],
    ],
    [234, 751],
    [253, 991],
    [571, 755],
    [595, 994],
    [821, 878],
    1020,
  ),
  legParts(
    [
      [123, 1049, 198, 362],
      [444, 1048, 200, 370],
      [723, 1201, 307, 209],
    ],
    [171, 1117],
    [232, 1356],
    [604, 1112],
    [575, 1366],
    [793, 1270],
    1404,
  ),
];
function rig(
  name: string,
  top: number,
  hips: [[number, number], [number, number]],
  shoulders: [[number, number], [number, number]],
  arms: [Part, Part],
  legs: LegParts,
): RigDefinition {
  const center: [number, number] = [(hips[0][0] + hips[1][0]) / 2, (hips[0][1] + hips[1][1]) / 2];
  return {
    src: `/assets/mech-siege/${name}.png`,
    top,
    body: part([0, 0, 475, 530], center),
    hips: hips.map((p) => point(...p)) as [Point, Point],
    shoulders: shoulders.map((p) => point(...p)) as [Point, Point],
    arms,
    thighs: [legs.thigh, legs.thigh],
    shins: [legs.shin, legs.shin],
    feet: [legs.foot, legs.foot],
    soles: [legs.sole, legs.sole],
  };
}
// 坐标对应原始透明图中的关节中心；分片在加载时建立，不重采样或改写原图。
export const BIPED_RIGS: Record<BipedType, RigDefinition> = {
  basic: rig(
    'basic-rig-v2',
    45,
    [
      [270, 459],
      [165, 461],
    ],
    [
      [291, 345],
      [144, 343],
    ],
    [
      part([830, 100, 230, 400], [974, 176], [914, 437]),
      part([500, 100, 230, 400], [590, 176], [650, 437]),
    ],
    LEGS[0],
  ),
  armor: {
    ...rig(
      'armor-rig-v1',
      24,
      [
        [335, 416],
        [187, 409],
      ],
      [
        [380, 296],
        [108, 247],
      ],
      [
        { ...part([568, 133, 409, 780], [791, 258], [771, 752]), texture: 'armorEquipment' },
        { ...part([58, 313, 461, 597], [222, 261], [372, 752]), texture: 'armorEquipment' },
      ],
      LEGS[1],
    ),
    // 盾与前臂分别定尺寸，固定在远侧前臂旁；不再随整条带肩甲的手臂一起缩小。
    shield: {
      part: { ...part([1072, 12, 414, 1010], [1279, 517]), texture: 'armorEquipment' },
      pixelHeight: 970,
      height: 68,
      widthScale: 0.77,
      gripFraction: 0.5,
      offset: { x: 12.5, y: -1.5 },
      angleOffset: 0.22,
    },
  },
  bomber: rig(
    'bomber-rig-v1',
    37,
    [
      [330, 481],
      [180, 482],
    ],
    [
      [402, 306],
      [94, 306],
    ],
    [
      // 肩甲与短上臂在身体层；前臂必须围绕真实下接口旋转，外置旧肩轴会把裁片拉断。
      part([500, 260, 250, 265], [606, 267], [654, 478]),
      part([860, 260, 250, 265], [966, 267], [1010, 480]),
    ],
    LEGS[2],
  ),
  commander: rig(
    'commander-rig-v1',
    32,
    [
      [350, 478],
      [201, 476],
    ],
    [
      [382, 350],
      [212, 330],
    ],
    [
      part([520, 90, 235, 440], [585, 181], [680, 470]),
      part([835, 90, 250, 440], [999, 180], [964, 480]),
    ],
    LEGS[3],
  ),
};
export function isBiped(type: string): type is BipedType {
  return (BIPED_TYPES as readonly string[]).includes(type);
}
