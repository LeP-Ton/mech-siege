import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Flag,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Zap,
} from 'lucide-react';
import { BattleScene } from '../render/BattleScene';
import type { SceneBridge } from '../render/BattleScene';
import { DIFFICULTIES, ZOMBIES, ZOMBIE_TYPES } from '../game/config';
import type { ZombieType } from '../game/config';
import type { Challenge, GameMap, Replay } from '../game/types';
import { GameSimulation } from '../game/simulation';
import { formatTime, gradeFor, thresholdsFor } from '../game/challenges';
import { loadReplay, RecordStore, shareText } from '../game/records';
import { formatSeed } from '../game/random';
import { copyText, Portrait } from './components';
export interface BattleSession {
  map: GameMap;
  challenge?: Challenge;
  replay?: Replay;
  id: number;
}
export function Battle({
  session,
  store,
  reducedMotion,
  onExit,
  onRetry,
  onNext,
  toast,
}: {
  session: BattleSession;
  store: RecordStore;
  reducedMotion: boolean;
  onExit: () => void;
  onRetry: () => void;
  onNext: () => void;
  toast: (text: string) => void;
}) {
  const { map, replay, challenge } = session;
  const [sim] = useState(() => (replay ? loadReplay(map, replay) : new GameSimulation(map)));
  const [bestBefore] = useState(() => store.get(map)?.best);
  const [selected, setSelected] = useState<ZombieType>('basic');
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [, render] = useState(0);
  const [record, setRecord] = useState(false);
  const [settled, setSettled] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const chosen = useRef(selected);
  chosen.current = selected;
  const pauseRef = useRef(paused);
  pauseRef.current = paused;
  const commandOrder = useRef(0);
  const finished = useRef(false);
  const thresholds = challenge?.thresholds ?? thresholdsFor(map);
  const deploy = useRef((row: number) => {
    if (replay || pauseRef.current || sim.state.status !== 'running') return;
    const unit = chosen.current;
    if (!sim.canDeploy(unit)) {
      toast(
        sim.state.tick < sim.state.cooldowns[unit]
          ? '兵种正在冷却，请稍候。'
          : '电能不足，等待恢复后再部署。',
      );
      return;
    }
    sim.queue({
      tick: sim.state.tick + 1,
      order: ++commandOrder.current,
      type: 'deploy',
      unit,
      row,
    });
  });
  const bridge = useRef<SceneBridge>({
    sim,
    paused: false,
    reducedMotion,
    replay: !!replay,
    speed: 1,
    onUpdate: () => render((n) => n + 1),
    onLane: (row) => deploy.current(row),
    onReady: () => setReady(true),
    onLoadError: (file) => toast(`素材 ${file} 加载失败，请刷新后重试。`),
  });
  bridge.current.paused = paused;
  bridge.current.reducedMotion = reducedMotion;
  bridge.current.speed = speed;
  useEffect(() => {
    if (!replay) store.start(map);
    if (store.warning) toast(store.warning);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current!,
      width: host.current!.clientWidth,
      height: host.current!.clientHeight,
      transparent: true,
      scene: new BattleScene(bridge.current),
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      render: { antialias: true },
      banner: false,
      audio: { noAudio: true },
    });
    return () => {
      game.destroy(true);
    };
    // 一次 session 对应一个模拟器和 Phaser 实例，重开由父组件更换 key。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) setPaused(true);
    };
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space' || e.code === 'Escape') {
        e.preventDefault();
        if (sim.state.status === 'running') setPaused((p) => !p);
      }
      const digit = /^Digit([1-6])$/.exec(e.code)?.[1];
      if (digit && !e.shiftKey) setSelected(ZOMBIE_TYPES[Number(digit) - 1]);
      if (e.shiftKey && digit && Number(digit) <= 5) {
        e.preventDefault();
        deploy.current(Number(digit) - 1);
      }
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('keydown', key);
    };
  }, [sim]);
  useEffect(() => {
    if (sim.state.status === 'running' || finished.current) return;
    finished.current = true;
    if (!replay) setRecord(store.finish(sim, thresholds));
    else if (sim.checksum() !== replay.checksum || sim.state.tick !== replay.finalTick)
      toast('回放校验失败，此结果不会写入成绩。');
    setSettled(true);
    if (store.warning) toast(store.warning);
  }, [sim.state.status, sim, store, thresholds, replay, toast]);
  const s = sim.state;
  const won = s.status === 'won';
  const cooldown = (t: ZombieType) => Math.max(0, (s.cooldowns[t] - s.tick) / 30);
  return (
    <div className="battle-page">
      <header className="battle-header">
        <button className="back-link" onClick={onExit}>
          <ArrowLeft size={17} />
          返回指挥舱
        </button>
        <div className="battle-map-name">
          <Flag size={16} />
          <b>{challenge?.name ?? '未命名战区'}</b>
          <span className={`difficulty ${map.difficulty}`}>
            {DIFFICULTIES[map.difficulty].name}
          </span>
          <span className="muted seed-label">{formatSeed(map.seed)}</span>
        </div>
        <div className="best-time">
          <Trophy size={15} />
          <span>
            最快 <b>{formatTime(bestBefore)}</b>
          </span>
        </div>
        <button
          className="icon-button"
          aria-label={paused ? '继续战斗' : '暂停战斗'}
          disabled={s.status !== 'running'}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play size={19} /> : <Pause size={19} />}
        </button>
      </header>
      <section className="battle-shell">
        <div className="battle-hud">
          <div className="hud-time">
            <Clock3 size={22} />
            <div>
              <span>作战时间</span>
              <b>{formatTime(s.tick)}</b>
            </div>
            <small>/ 03:30</small>
          </div>
          <div className="energy-hud">
            <span>
              <Zap size={16} />
              电能 <b>{Math.floor(s.energy / 1000)}</b>
              <small>/ 320</small>
            </span>
            <div className="meter">
              <i style={{ width: `${(s.energy / 320000) * 100}%` }} />
            </div>
            <small>+8 / 秒</small>
          </div>
          <div className="core-hud">
            <span>
              <CoreIcon />
              防御中枢 <b>{Math.ceil(s.coreHp / 1000)}</b>
              <small>/ 450</small>
            </span>
            <div className="meter">
              <i style={{ width: `${(s.coreHp / 450000) * 100}%` }} />
            </div>
          </div>
          <button className="icon-button" title="重新挑战" aria-label="重新挑战" onClick={onRetry}>
            <RotateCcw size={18} />
          </button>
        </div>
        <div className="battle-canvas-wrap">
          <div className="battle-canvas" ref={host} aria-label="战场：点击任一路线部署所选机器人" />
          <div className="mission-banner" aria-hidden="true">
            <span>
              {replay ? '战术回溯' : '破城行动'} <i /> {DIFFICULTIES[map.difficulty].name}
            </span>
            <h1>{replay ? '重演最佳战术' : '突破防线。摧毁中枢。'}</h1>
          </div>
          {!ready && (
            <div className="canvas-overlay">
              <span className="loader" />
              正在准备阵地…
            </div>
          )}
          {paused && s.status === 'running' && (
            <div className="canvas-overlay paused">
              <div>
                <Pause size={32} />
                <h2>稍作休整</h2>
                <p>战斗、资源与竞速计时已暂停。</p>
                <button className="btn primary" onClick={() => setPaused(false)}>
                  <Play size={16} />
                  继续出击
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="battle-instruction">
          <span>
            <span className="live-dot" />
            {replay ? (
              '正在按原始 Tick 重放命令'
            ) : (
              <>
                选择兵种，再点击任意路线部署 <ChevronRight size={14} />
                <b>{ZOMBIES[selected].name}</b>
              </>
            )}
          </span>
          {replay ? (
            <button className="text-button" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>
              播放速度 {speed}×
            </button>
          ) : (
            <span className="key-hint">1–6 选兵 · Shift + 1–5 出兵 · 空格暂停</span>
          )}
        </div>
      </section>
      <div className="battle-dock">
        <div className="dock-heading">
          <span>
            机动小队 <b> / 选择部署</b>
          </span>
          <span>1–6 选兵 · Shift + 1–5 出兵</span>
        </div>
        <div className="unit-cards" aria-label="机器人兵种">
          {ZOMBIE_TYPES.map((type, i) => {
            const unit = ZOMBIES[type],
              cd = cooldown(type),
              unavailable = !sim.canDeploy(type);
            return (
              <button
                key={type}
                className={`unit-card ${selected === type ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}`}
                aria-label={`选择${unit.name}，消耗${unit.cost}电能`}
                aria-pressed={selected === type}
                disabled={!!replay}
                onClick={() => setSelected(type)}
                title={unit.description}
              >
                <span className="unit-key">{i + 1}</span>
                <span className="unit-role">{unit.role}</span>
                <Portrait type={type} />
                <h3>{unit.name}</h3>
                <div className="unit-cost">
                  <Zap size={13} />
                  {unit.cost}
                  <span>{cd > 0 ? `${cd.toFixed(1)}秒` : '就绪'}</span>
                </div>
                {cd > 0 && (
                  <>
                    <div
                      className="cooldown-mask"
                      aria-hidden="true"
                      style={{ height: `${((cd * 30) / unit.cooldown) * 100}%` }}
                    />
                    <div
                      className="cooldown-bar"
                      style={{ width: `${((cd * 30) / unit.cooldown) * 100}%` }}
                    />
                  </>
                )}
              </button>
            );
          })}
        </div>
        <div className="selected-description">
          <span>{ZOMBIES[selected].description}</span>
          <span>
            生命 {ZOMBIES[selected].hp} <i /> 移速 {ZOMBIES[selected].speed} 格/秒
          </span>
        </div>
      </div>
      {settled && (
        <div className="modal-backdrop">
          <div className="result-dialog" role="dialog" aria-modal="true" aria-label="战斗结算">
            <span className={`result-grade ${won ? '' : 'lost'}`}>
              {won ? gradeFor(s.tick, thresholds) : '×'}
            </span>
            <span className="kicker">
              {replay
                ? '回放结束'
                : won
                  ? record
                    ? 'PERSONAL BEST · 新纪录'
                    : 'MISSION COMPLETE'
                  : 'TIME IS UP'}
            </span>
            <h2>
              {won
                ? record
                  ? '漂亮！新的最快纪录'
                  : '防御火力网，已突破！'
                : '时间到了，再试一次'}
            </h2>
            <p>
              {won
                ? '每一次突破，都是更好战术的开始。'
                : '试试集中一条路线，让铁甲为疾行吸引火力。'}
            </p>
            <div className="result-time">{formatTime(s.tick)}</div>
            {record && bestBefore && (
              <div className="improvement">
                比历史最佳快 {((bestBefore - s.tick) / 30).toFixed(2)} 秒
              </div>
            )}
            <div className="result-stats">
              <div>
                <span>历史最快</span>
                <b>{formatTime(store.get(map)?.best)}</b>
              </div>
              <div>
                <span>消耗电能</span>
                <b>{s.spent}</b>
              </div>
              <div>
                <span>部署机器人</span>
                <b>{s.deployed} 台</b>
              </div>
              <div>
                <span>核心生命</span>
                <b>{Math.ceil(s.coreHp / 1000)} / 450</b>
              </div>
            </div>
            {replay && (
              <p className="verified">
                <Check size={14} />
                {sim.checksum() === replay.checksum
                  ? '回放终局与原始纪录校验一致'
                  : '回放校验不一致'}
              </p>
            )}
            <div className="result-actions">
              <button className="btn primary" onClick={onRetry}>
                <RotateCcw size={16} />
                再战一次
              </button>
              {challenge && won && (
                <button className="btn secondary" onClick={onNext}>
                  下一张地图
                  <ArrowRight size={16} />
                </button>
              )}
              <button
                className="btn secondary"
                onClick={async () => {
                  const ok = await copyText(shareText(map, store.get(map)?.best));
                  toast(
                    ok
                      ? '挑战文本已复制，发给朋友来一场竞速！'
                      : '复制失败，请在浏览器允许剪贴板访问。',
                  );
                }}
              >
                <Copy size={15} />
                分享挑战
              </button>
            </div>
            <button className="back-link result-back" onClick={onExit}>
              返回指挥舱
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function CoreIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8Z" />
      <path d="M9 9h6v6H9ZM12 3v6M12 15v6M3 12h6M15 12h6" />
    </svg>
  );
}
