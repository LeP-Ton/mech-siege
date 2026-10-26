export const RULES_VERSION = 'R1';
export const GENERATOR_VERSION = 'G1';
export const TICK_RATE = 30;
export const SCALE = 10_000;
export const ABILITIES = {
  armorReduction: 0.2,
  commanderRange: 1.8,
  commanderMultiplier: 1.3,
  burrowEnd: 7.2,
  blastRadius: 1.4,
  frostMultiplier: 0.55,
  frostDuration: 60,
  splashRadius: 0.9,
  plantBombRadius: 1.2,
  flowerEnergy: 25,
  trapPeriod: 120,
  trapActive: 30,
  trapDamage: 35,
  mudMultiplier: 0.65,
  roadMultiplier: 1.25,
  rockMultiplier: 0.5,
} as const;
export const RULES = {
  rows: 5,
  cols: 12,
  limitTicks: 210 * TICK_RATE,
  coreHp: 450,
  energy: 160,
  regen: 8,
  maxEnergy: 320,
} as const;
export type ZombieType = 'basic' | 'armor' | 'runner' | 'digger' | 'bomber' | 'commander';
export type PlantType = 'shooter' | 'wall' | 'frost' | 'flower' | 'bomb' | 'detector' | 'cannon';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';
export type TerrainType = 'mud' | 'road' | 'tunnel' | 'rock' | 'trap';
export const ZOMBIES: Record<
  ZombieType,
  {
    name: string;
    cost: number;
    hp: number;
    speed: number;
    dps: number;
    cooldown: number;
    color: string;
    description: string;
    role: string;
  }
> = {
  basic: {
    name: '先锋机器人',
    cost: 45,
    hp: 160,
    speed: 0.65,
    dps: 18,
    cooldown: 75,
    color: '#99bc71',
    description: '低成本先锋，适合消耗陷阱与持续增援。',
    role: '先锋',
  },
  armor: {
    name: '重装机器人',
    cost: 90,
    hp: 420,
    speed: 0.42,
    dps: 18,
    cooldown: 150,
    color: '#99acc1',
    description: '普通弹丸减伤 20%，让重装走在队伍最前方。',
    role: '坦克',
  },
  runner: {
    name: '疾行机器人',
    cost: 65,
    hp: 95,
    speed: 1.25,
    dps: 14,
    cooldown: 105,
    color: '#edac69',
    description: '移动迅速，跟随重装突破薄弱路线。',
    role: '突袭',
  },
  digger: {
    name: '掘地机器人',
    cost: 110,
    hp: 130,
    speed: 0.8,
    dps: 19,
    cooldown: 210,
    color: '#c1a27b',
    description: '潜行至第 8 列后出土，地磁雷达会提前迫使其现身。',
    role: '渗透',
  },
  bomber: {
    name: '爆破机器人',
    cost: 100,
    hp: 125,
    speed: 0.75,
    dps: 190,
    cooldown: 180,
    color: '#d99187',
    description: '接触后自爆，对 1.4 格内的防御设备和核心造成 190 伤害。',
    role: '爆发',
  },
  commander: {
    name: '指挥机器人',
    cost: 140,
    hp: 240,
    speed: 0.6,
    dps: 12,
    cooldown: 270,
    color: '#ad8bcc',
    description: '周围 1.8 格内友军伤害提升 30%，同类增益不叠加。',
    role: '支援',
  },
};
export const ZOMBIE_TYPES = Object.keys(ZOMBIES) as ZombieType[];
export const PLANTS: Record<
  PlantType,
  {
    name: string;
    hp: number;
    damage: number;
    interval: number;
    range: number;
    budget: number;
    color: string;
    description: string;
  }
> = {
  shooter: {
    name: '动能炮塔',
    hp: 90,
    damage: 14,
    interval: 36,
    range: 8,
    budget: 2,
    color: '#5d9c75',
    description: '向同路线左侧最近的地上机器人发射弹丸。',
  },
  wall: {
    name: '装甲屏障',
    hp: 300,
    damage: 0,
    interval: 30,
    range: 0,
    budget: 3,
    color: '#b78d5e',
    description: '高生命值阻挡单位，不主动攻击。',
  },
  frost: {
    name: '冷冻发射器',
    hp: 75,
    damage: 8,
    interval: 48,
    range: 6,
    budget: 2,
    color: '#7dc9db',
    description: '冰弹使移速降至 55%，持续 2 秒；减速不叠加。',
  },
  flower: {
    name: '供能站',
    hp: 55,
    damage: 0,
    interval: 30,
    range: 0,
    budget: 1,
    color: '#edbb5f',
    description: '低防御补给目标，摧毁时立即获得 25 电能。',
  },
  bomb: {
    name: '感应地雷',
    hp: 65,
    damage: 95,
    interval: 1,
    range: 0.7,
    budget: 2,
    color: '#d77d67',
    description: '敌人接近时自毁，对 1.2 格范围造成一次伤害。',
  },
  detector: {
    name: '地磁雷达',
    hp: 85,
    damage: 6,
    interval: 30,
    range: 3,
    budget: 2,
    color: '#ab90c9',
    description: '探测同路线 3 格内的地下单位，使其永久出土。',
  },
  cannon: {
    name: '等离子重炮',
    hp: 150,
    damage: 36,
    interval: 75,
    range: 9,
    budget: 4,
    color: '#728f9f',
    description: '向同路线左侧最近目标发射 0.9 格范围等离子弹。',
  },
};
export const DIFFICULTIES: Record<
  Difficulty,
  { name: string; budget: number; maxPlants: number; terrains: number }
> = {
  easy: { name: '简单', budget: 17, maxPlants: 12, terrains: 2 },
  normal: { name: '普通', budget: 25, maxPlants: 17, terrains: 4 },
  hard: { name: '困难', budget: 35, maxPlants: 23, terrains: 6 },
  extreme: { name: '极限', budget: 45, maxPlants: 28, terrains: 9 },
};
export const STYLES = [
  '交叉火力',
  '多层装甲',
  '后方补给',
  '地下通道',
  '工业障碍',
  '火力缺口',
  '周期脉冲',
] as const;
export const TERRAIN_INFO: Record<TerrainType, string> = {
  mud: '冷却液洼地：地上单位移速 ×0.65',
  road: '磁轨加速带：地上单位移速 ×1.25',
  tunnel: '检修通道：掘地机器人在此格不会被探测',
  rock: '工业残骸：地上单位移速 ×0.5，不永久封路',
  trap: '脉冲电网：每 4 秒激活 1 秒，每轮对进入的地上单位造成一次 35 伤害',
};

// 新展示层使用机器人/防御设备命名；R1 持久化字段和稳定 ID 保持兼容。
export type RobotType = ZombieType;
export type DefenseType = PlantType;
export const ROBOTS = ZOMBIES;
export const ROBOT_TYPES = ZOMBIE_TYPES;
export const DEFENSES = PLANTS;
