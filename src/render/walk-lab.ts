import Phaser from 'phaser';
import { RobotActor } from './RobotActor';
import type { RigAction } from './RobotActor';
import { PART_ATLASES } from './rigs';
import { ROBOT_TYPES, ROBOT_RIG_URLS } from './robotPose';
import { robotCycleDistance } from './robotProfiles';
import { cycle } from './gait';
import { actorName } from './art';

const playback = {
  paused: false,
  speed: 1,
  action: 'walk' as RigAction,
  distance: 0,
  step: false,
  view: 'all',
  joints: false,
};
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
const label = document.querySelector<HTMLElement>('#stage-label')!;
const telemetry = document.querySelector<HTMLOutputElement>('#telemetry')!;
pause.onclick = () => {
  playback.paused = !playback.paused;
  pause.textContent = playback.paused ? '继续' : '暂停';
};
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-speed]'))
  button.onclick = () => {
    playback.speed = Number(button.dataset.speed);
    document
      .querySelectorAll('[data-speed]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]'))
  button.onclick = () => {
    playback.action = button.dataset.action as RigAction;
    document
      .querySelectorAll('[data-action]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
  };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-phase]'))
  button.onclick = () => {
    playback.distance = Number(button.dataset.phase);
    playback.paused = true;
    playback.step = true;
    pause.textContent = '继续';
  };
document.querySelector<HTMLSelectElement>('#actor-view')!.onchange = (e) => {
  playback.view = (e.target as HTMLSelectElement).value;
};
document.querySelector<HTMLInputElement>('#show-joints')!.onchange = (e) => {
  playback.joints = (e.target as HTMLInputElement).checked;
};
class WalkLab extends Phaser.Scene {
  private actors: RobotActor[] = [];
  private names: Phaser.GameObjects.Text[] = [];
  private floor!: Phaser.GameObjects.Graphics;
  private bones!: Phaser.GameObjects.Graphics;
  preload() {
    for (const type of ROBOT_TYPES) this.load.image(`rig-${type}`, ROBOT_RIG_URLS[type]);
    for (const atlas of Object.values(PART_ATLASES)) this.load.image(atlas.key, atlas.src);
  }
  create() {
    this.floor = this.add.graphics().setDepth(-1);
    this.bones = this.add.graphics().setDepth(100);
    ROBOT_TYPES.forEach((type) => {
      this.actors.push(new RobotActor(this, type));
      this.names.push(
        this.add
          .text(0, 0, actorName(type), {
            fontFamily: 'sans-serif',
            fontSize: '20px',
            color: '#e3e6d9',
          })
          .setOrigin(0.5),
      );
    });
    label.textContent = '六机体已加载 · 重装单层肩甲与大盾 / 疾行手臂朝向修正 / 双轮与履带微震';
  }
  update(_time: number, delta: number) {
    if (!this.floor) return;
    if (!playback.paused && (playback.action === 'walk' || playback.action === 'hit'))
      playback.distance += (Math.min(delta, 100) / 1000) * 0.95 * playback.speed;
    const focused = playback.view !== 'all',
      height = focused ? 360 : 235;
    if (this.scale.height !== (focused ? 500 : 740)) this.scale.resize(1000, focused ? 500 : 740);
    const scale = height / 100,
      phase = cycle(playback.distance);
    this.floor.clear();
    this.bones.clear();
    let status = '';
    this.actors.forEach((actor, i) => {
      const visible = !focused || playback.view === actor.type;
      actor.container.setVisible(visible);
      this.names[i].setVisible(visible);
      if (!visible) return;
      const x = focused ? 500 : 170 + (i % 3) * 330;
      const ground = focused ? 430 : i < 3 ? 330 : 690;
      const distance = playback.distance * robotCycleDistance(actor.type) * scale;
      const left = focused ? 0 : x - 160,
        right = focused ? 1000 : x + 160;
      this.floor.fillStyle(0x31464d).fillRect(left, ground, right - left, 34);
      this.floor.lineStyle(1, 0x90b0b7, 0.9).lineBetween(left, ground, right, ground);
      for (let mark = left + 40; mark < right - 40; mark += 40) {
        const markX = mark - (distance % 40);
        this.floor
          .lineStyle(1, 0x638188, 0.5)
          .lineBetween(markX, ground + 3, markX - 14, ground + 29);
      }
      this.names[i].setPosition(x, focused ? 35 : ground - height - 30);
      const result = actor.update({
        x,
        y: ground,
        height,
        distance,
        delta: delta * playback.speed,
        frozen: playback.paused && !playback.step,
        snapMotion: playback.step,
        action: playback.action,
        tint: playback.speed === 0.55 ? 0xa5dfff : undefined,
      });
      if (!status) {
        status =
          result.pose.mode === 'track'
            ? '履带：连续绕行　轮轴：按前进距离滚动'
            : result.pose.legs
                .map((leg, side) =>
                  result.pose.mode === 'roll'
                    ? `${side ? '近侧轮' : '远侧轮'}：固定轮轴　持续贴地滚动`
                    : `${side ? '近侧脚' : '远侧脚'}：${leg.foot.planted || result.weight === 0 ? '贴地支撑' : '抬脚前摆'}　离地 ${(-leg.foot.y).toFixed(2)}`,
                )
                .join('\n');
        status += `\n移动权重 ${result.weight.toFixed(4)}`;
      }
      if (playback.joints)
        result.pose.legs.forEach((leg, side) => {
          const points = [leg.hip, leg.knee, leg.ankle, leg.sole].map((p) => ({
            x: x + p.x * scale,
            y: ground + p.y * scale,
          }));
          const color = side ? 0xffc454 : 0x70dfec;
          this.bones.lineStyle(2, color, 0.9).strokePoints(points);
          this.bones.fillStyle(color, 1);
          points.forEach((p) => this.bones.fillCircle(p.x, p.y, 3));
        });
    });
    playback.step = false;
    telemetry.textContent = `循环相位 ${(phase * 100).toFixed(2)}%　${playback.paused ? '已暂停' : '播放中'}　速度 ${playback.speed} 倍\n${status}`;
  }
}
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: 1000,
  height: 500,
  backgroundColor: '#23363e',
  scene: WalkLab,
  banner: false,
  audio: { noAudio: true },
  render: { antialias: true },
});
