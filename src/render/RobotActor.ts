import Phaser from 'phaser';
import type { RobotType } from '../game/config';
import { gaitPhase } from './gait';
import { robotCycleDistance } from './robotProfiles';
import { robotPose } from './robotPose';
import { advanceRobotMotion } from './robotMotion';
import type { RigAction } from './bipedPose';
import { PART_ATLASES } from './rigs';
export type { RigAction } from './bipedPose';

export class RobotActor {
  readonly container: Phaser.GameObjects.Container;
  private parts = new Map<
    string,
    { root: Phaser.GameObjects.Container; image: Phaser.GameObjects.Image }
  >();
  private motion = { weight: 0, attack: 0, hit: 0 };
  constructor(
    scene: Phaser.Scene,
    readonly type: RobotType,
  ) {
    this.container = scene.add.container(0, 0);
    for (const drawn of robotPose(type, 0, 0, 'idle').parts) {
      const { name, part } = drawn;
      const key = part.texture ? PART_ATLASES[part.texture].key : `rig-${type}`;
      const frame = `${type}-${name}`,
        texture = scene.textures.get(key);
      if (!texture.has(frame)) texture.add(frame, 0, ...part.rect);
      const image = scene.add
        .image(0, 0, key, frame)
        .setOrigin(
          (part.pivot.x - part.rect[0]) / part.rect[2],
          (part.pivot.y - part.rect[1]) / part.rect[3],
        )
        .setRotation(Math.PI / 2 - (drawn.axis ?? Math.PI / 2));
      const root = scene.add.container(0, 0, image);
      this.parts.set(name, { root, image });
      this.container.add(root);
    }
  }
  update(options: {
    x: number;
    y: number;
    height: number;
    distance: number;
    delta: number;
    frozen: boolean;
    action: RigAction;
    attackPulse?: number;
    tint?: number;
    snapMotion?: boolean;
  }) {
    const { x, y, height, distance, delta, frozen, action, tint } = options;
    this.motion = advanceRobotMotion(
      this.motion,
      action,
      delta,
      frozen,
      options.snapMotion,
      options.attackPulse,
    );
    const phase = gaitPhase(distance, height, robotCycleDistance(this.type));
    const pose = robotPose(
      this.type,
      phase,
      this.motion.weight,
      action,
      options.attackPulse,
      this.motion,
      (distance * 100) / height,
    );
    for (const { name, position, scale, angle, widthScale = 1, axis = Math.PI / 2 } of pose.parts) {
      const part = this.parts.get(name)!;
      part.root
        .setPosition(position.x, position.y)
        .setScale(scale * widthScale, scale)
        .setRotation(angle + axis - Math.PI / 2);
      part.image.setTint(
        tint ?? (name.startsWith('far') && name !== 'farShield' ? 0xbcc9d2 : 0xffffff),
      );
    }
    this.container.setPosition(x, y).setScale(height / 100);
    return { phase, weight: this.motion.weight, pose };
  }
  destroy() {
    this.container.destroy();
  }
}
