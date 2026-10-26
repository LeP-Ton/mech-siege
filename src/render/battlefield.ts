// 与背景地坪的五条嵌入式轨缝对齐，所有单位、地形和命中区域共用此投影。
export const FIELD_WIDTH = 1200;
export const FIELD_HEIGHT = 675;
export const LANE_EDGES = [236, 290, 350, 420, 505, 594];
export const CORE_POSITION = { x: 1105, y: 407 };

export function fieldPoint(column: number, row: number, edge = false) {
  const left = 103 - row * 11;
  const width = 938 + row * 17;
  return {
    x: left + (column / 12) * width,
    y: edge ? LANE_EDGES[row] : LANE_EDGES[row + 1] - 12,
    scale: 0.82 + row * 0.045,
  };
}

export function laneAt(x: number, y: number) {
  const row = LANE_EDGES.findIndex((edge, i) => i < 5 && y >= edge && y < LANE_EDGES[i + 1]);
  if (row < 0) return -1;
  const start = fieldPoint(0, row).x;
  return x >= start - 67 && x <= fieldPoint(12, row).x ? row : -1;
}

export function walkFrame(column: number, phase: number, frames: readonly number[]) {
  // 步态绑定实际位移，因此减速、停步和暂停不会继续空踩。
  return frames[Math.floor(column * 12 + phase) % frames.length];
}
