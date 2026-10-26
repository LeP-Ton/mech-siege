import { describe, expect, it } from 'vitest';
import { actorPose, UNIT_VISUALS } from './art';
import frameLayout from './frame-layout.json';
import { fieldPoint, laneAt, LANE_EDGES, walkFrame } from './battlefield';
import { ROBOT_TYPES } from '../game/config';

describe('战场投影与步态回归', () => {
  it('五路从远景到近景均能点击，边界外和中枢区域不部署', () => {
    for (let row = 0; row < 5; row++) {
      const y = (LANE_EDGES[row] + LANE_EDGES[row + 1]) / 2;
      for (const column of [0, 0.5, 6, 11.9])
        expect(laneAt(fieldPoint(column, row).x, y)).toBe(row);
    }
    expect(laneAt(500, 235)).toBe(-1);
    expect(laneAt(500, 594)).toBe(-1);
    expect(laneAt(1150, 400)).toBe(-1);
  });
  it('六种机器人所有步态的可见脚底与身高保持一致，倒地保持原比例', () => {
    for (const type of ROBOT_TYPES) {
      const visual = UNIT_VISUALS[type];
      const heights = visual.animations.move.map((frame) => {
        const pose = actorPose(type, frame),
          bounds = frameLayout[type][frame];
        const scale = pose.height / visual.frameHeight;
        expect((bounds.y + bounds.height) * scale - pose.originY * pose.height).toBeCloseTo(0, 8);
        return bounds.height * scale;
      });
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.01);
      expect(actorPose(type, 7).height).toBeCloseTo(actorPose(type, 0).height);
    }
  });
  it('停步和减速以位移决定动画，不随全局时间继续空踩', () => {
    const frames = [1, 2, 3, 4];
    expect(walkFrame(0, 0, frames)).toBe(1);
    expect(walkFrame(1 / 12, 0, frames)).toBe(2);
    expect(walkFrame(2 / 12, 0, frames)).toBe(3);
    expect(walkFrame(3 / 12, 0, frames)).toBe(4);
    expect(walkFrame(4 / 12, 0, frames)).toBe(1);
    expect(walkFrame(0.01, 0, frames)).toBe(walkFrame(0.02, 0, frames));
  });
});
