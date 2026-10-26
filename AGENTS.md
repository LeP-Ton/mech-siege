# 《机械围城》

## 项目定位与技术栈
纯前端、原创科幻卡通 2D 机器人攻城竞速游戏，无账号、后端或在线排行榜。使用 TypeScript、React、Phaser 3、Vite、Vitest 和 localStorage。Node.js >=20.19，npm 管理依赖。

## 核心架构与目录
- `src/game/`：无 DOM、无 Phaser 依赖的确定性地图、战斗、机器人、回放和纪录规则。
- `src/render/`：原创 imagegen 精灵素材、Phaser 场景与声音；只消费模拟快照和事件。
- `src/ui/`：React 页面、HUD、地图预览、交互与本地状态。
- `src/game/config.ts`：版本化单位、地形和战斗参数。影响战斗或地图的配置变更需要增加对应版本，保留旧实现。
- `src/game/*.test.ts`：规则与确定性验证；官方地图必须经过机器人通关验证。

## 运行和验证
`npm install`、`npm run dev`。交付前运行 `npm run typecheck`、`npm test`、`npm run build`，并通过浏览器验证完整交互。`npm run validate:maps` 单独验证地图。

## 项目检索方法
依次阅读 `AGENTS.md` → `.agentdocs/index.md` → 与任务相关的 workflow 文档 → 有针对性地检索源码。不要全量扫描历史文档。

## 开发规范
- 中文沟通、文档与注释；注释说明原因。保持规则与渲染解耦。
- 30 Tick/秒；模拟使用整数坐标与整数生命值，不读取墙上时钟，不使用 Math.random。
- 目标和事件按稳定 ID 排序；输入命令绑定 Tick 和顺序，回放只消费命令。
- 开始代码任务前检查分支。每次任务创建带 `YYYYMMDDHHmmss` 前缀的新变更文档，同一任务更新同一文档，并维护根索引。
- 禁止直接使用《植物大战僵尸》的受保护资产。新美术由内置 imagegen 原创生成，提示词记录在 public/assets/mech-siege/asset-prompts.json；声音为程序合成。
- AGENTS.md 只记录项目长期认知；需求决策和测试结果写入 workflow，精确历史由 Git 管理。

## 品牌与兼容
- 展示及分享使用 MS-G1 种子，normalizeSeed 内部规范化为旧 ZVP-G1 身份。
- gamex.records.v1 / gamex.settings.v1、R1/G1、单位 ID、序列化字段和校验顺序必须保持兼容。
- src/render/art.ts 是角色、动画帧、锚点与环境的共用清单。public/assets/mech-siege/ 保存实际 PNG 与提示词。
- 六种机器人统一由 src/render/RobotActor.ts 和 robotMotion.ts 管理连续动作与过渡；robotPose.ts 分派双足、固定双轮和履带姿态，绘制顺序为远腿、身体、独立装备、近腿、近臂。bipedPose.ts、gait.ts 管理双足轨迹和关节求解，robotProfiles.ts 保存各机体比例；rigs.ts、mobileRigs.ts 记录真实独立部件、图集与圆轴中心。独立装备由所属肢体固定点驱动，分别定尺寸。横向加粗沿骨轴完成，脚掌独立旋转。walk-lab.html 提供逐机放大、相位与关节检查；验收覆盖真实 Alpha 轮廓、整机参考对照与浏览器连续帧。
- src/render/battlefield.ts 统一真实战场与预览的五路地面投影和点击命中；frame-layout.json 提供逐帧脚底定位。位置插值、步态和窗口适配只作用于表现层，不改变模拟或回放。
- src/game/fixtures/legacy-r1.json 固定改版前真实地图和回放，禁止随实现更新重新生成。
