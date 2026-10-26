import type { Part, Rect } from './rigs';

const part = (rect: Rect, x: number, y: number, tipX = x, tipY = y): Part => ({
  rect,
  pivot: { x, y },
  tip: { x: tipX, y: tipY },
});
// 生成图没有严格遵守网格，使用真实透明边界与可见圆轴，禁止按 512 格子推测裁片。
export const RUNNER_RIG = {
  src: '/assets/mech-siege/runner-rig-v1.png',
  top: 48,
  body: part([32, 28, 442, 495], 289, 471),
  hips: [
    { x: 340, y: 473 },
    { x: 239, y: 470 },
  ],
  shoulders: [
    { x: 367, y: 353 },
    { x: 220, y: 361 },
  ],
  arms: [
    { ...part([1143, 75, 210, 444], 1294, 140, 1210, 450), elbow: { x: 1264, y: 293 } },
    { ...part([713, 75, 216, 446], 767, 144, 860, 451), elbow: { x: 765, y: 296 } },
  ],
  thigh: part([177, 547, 195, 408], 245, 622, 268, 878),
  shin: part([687, 546, 162, 418], 754, 619, 755, 897),
  wheel: part([1063, 540, 433, 435], 1279, 758),
  wheelRadius: 199,
};
export const DIGGER_RIG = {
  src: '/assets/mech-siege/digger-rig-v1.png',
  top: 12,
  body: part([63, 0, 433, 574], 300, 520),
  shoulders: [
    { x: 431, y: 350 },
    { x: 165, y: 365 },
  ],
  arms: [
    part([612, 92, 317, 467], 695, 215, 850, 490),
    part([944, 129, 587, 367], 1030, 240, 1460, 400),
  ],
  // 底板不含轮组、链节，避免在烘焙好的整套履带上再次叠加另一套运动零件。
  track: { ...part([113, 101, 1237, 393], 731, 297.5), texture: 'diggerGear' as const },
  wheel: { ...part([223, 507, 460, 452], 453, 733), texture: 'diggerGear' as const },
  link: { ...part([911, 679, 519, 218], 1170.5, 788), texture: 'diggerGear' as const },
};
