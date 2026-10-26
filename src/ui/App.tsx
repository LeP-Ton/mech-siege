import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Dices,
  Flag,
  Cpu,
  Home,
  Map,
  Play,
  Settings,
  Shield,
  Shuffle,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CHALLENGES, formatTime, THEMES } from '../game/challenges';
import {
  DIFFICULTIES,
  PLANTS,
  RULES_VERSION,
  STYLES,
  TERRAIN_INFO,
  ZOMBIES,
  ZOMBIE_TYPES,
} from '../game/config';
import type { Difficulty } from '../game/config';
import { generateMap } from '../game/maps';
import { newSeed, formatSeed } from '../game/random';
import { loadReplay, RecordStore, shareText } from '../game/records';
import type { PersonalRecord } from '../game/records';
import type { Challenge, GameMap, Replay } from '../game/types';
import { configureAudio } from '../render/audio';
import {
  Badge,
  copyText,
  Dialog,
  EmptyRecord,
  MapCard,
  MapPreview,
  Portrait,
  SectionTitle,
  Tip,
} from './components';
import { HERO_URL } from '../render/art';
import type { BattleSession } from './Battle';
const Battle = lazy(() => import('./Battle').then((module) => ({ default: module.Battle })));
type Page = 'home' | 'official' | 'random' | 'records';
interface Selection {
  map: GameMap;
  challenge?: Challenge;
}
function getStore() {
  try {
    return new RecordStore(localStorage);
  } catch {
    const store = new RecordStore();
    store.warning = '浏览器已禁止本地存储，本次成绩仅保留在当前页面。';
    return store;
  }
}
interface GameSettings {
  sound: boolean;
  volume: number;
  reduced: boolean;
}
function initialSettings(): GameSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('gamex.settings.v1') ?? '{}');
    return {
      sound: typeof saved.sound === 'boolean' ? saved.sound : true,
      volume: typeof saved.volume === 'number' ? Math.max(0, Math.min(1, saved.volume)) : 0.4,
      reduced: typeof saved.reduced === 'boolean' ? saved.reduced : false,
    };
  } catch {
    return { sound: true, volume: 0.4, reduced: false };
  }
}
function initialMap() {
  const params = new URLSearchParams(location.search),
    seed = params.get('seed');
  if (!seed) return { map: generateMap('MS-G1-7J2K9Q'), error: '' };
  try {
    if (params.has('rules') && params.get('rules') !== RULES_VERSION)
      throw new Error('链接使用的规则版本暂不支持。');
    const difficulty = params.get('difficulty') ?? 'normal';
    if (!(difficulty in DIFFICULTIES)) throw new Error('链接中的难度无效。');
    return { map: generateMap(seed, difficulty as Difficulty), error: '' };
  } catch (e) {
    return { map: generateMap('MS-G1-7J2K9Q'), error: (e as Error).message };
  }
}
const NAV: { page: Page; title: string; icon: LucideIcon }[] = [
  { page: 'home', title: '指挥舱', icon: Home },
  { page: 'official', title: '官方挑战', icon: Flag },
  { page: 'random', title: '随机战场', icon: Dices },
  { page: 'records', title: '个人纪录', icon: Trophy },
];
export function App() {
  const [store] = useState(getStore);
  const [initial] = useState(initialMap);
  const [page, setPage] = useState<Page>(() =>
    new URLSearchParams(location.search).has('seed') ? 'random' : 'home',
  );
  const [randomMap, setRandomMap] = useState(initial.map);
  const [seedInput, setSeedInput] = useState(formatSeed(initial.map.seed));
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.map.difficulty);
  const [seedError, setSeedError] = useState(initial.error);
  const [theme, setTheme] = useState(-1);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [session, setSession] = useState<BattleSession | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [notification, setNotification] = useState('');
  const notifyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);
  const officialMaps = useMemo(() => CHALLENGES.map((c) => generateMap(c.seed, c.difficulty)), []);
  const toast = (message: string) => {
    setNotification(message);
    clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => setNotification(''), 4200);
  };
  useEffect(() => {
    configureAudio(settings.sound, settings.volume);
    try {
      localStorage.setItem('gamex.settings.v1', JSON.stringify(settings));
    } catch {
      /* 设置写入失败不阻止游戏。 */
    }
  }, [settings]);
  useEffect(() => {
    if (store.warning) toast(store.warning);
    return () => clearTimeout(notifyTimer.current);
  }, [store]);
  function start(selected: Selection, replay?: Replay) {
    setSelection(null);
    setSession({ ...selected, replay, id: ++nextId.current });
    window.scrollTo(0, 0);
  }
  function regenerate(seed = seedInput, level = difficulty) {
    try {
      const map = generateMap(seed, level);
      setRandomMap(map);
      setSeedInput(formatSeed(map.seed));
      setDifficulty(level);
      setSeedError('');
    } catch (e) {
      setSeedError((e as Error).message);
    }
  }
  const records = Object.values(store.records).sort(
    (a, b) => (a.best ?? Infinity) - (b.best ?? Infinity),
  );
  const wins = records.reduce((n, r) => n + r.wins, 0);
  const completed = CHALLENGES.filter((_, i) => (store.get(officialMaps[i])?.wins ?? 0) > 0).length;
  const bestRecord = records.find((r) => r.best);
  const title = NAV.find((n) => n.page === page)?.title;
  function showReplay(r: PersonalRecord) {
    if (!r.replay) return;
    try {
      const map = generateMap(r.seed, r.difficulty);
      if (r.replay.fingerprint !== map.fingerprint || r.rulesVersion !== RULES_VERSION)
        throw new Error('此纪录的版本与当前版本不兼容，无法回放。');
      loadReplay(map, r.replay);
      start(
        {
          map,
          challenge: CHALLENGES.find((c) => c.seed === r.seed && c.difficulty === r.difficulty),
        },
        r.replay,
      );
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <div className={settings.reduced ? 'app reduced-motion' : 'app'}>
      {!session && (
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage('home');
            }}
          >
            <span className="brand-icon">
              <Cpu size={27} />
            </span>
            <span>
              机械围城
              <small>MECH SIEGE</small>
            </span>
          </a>
          <div className="nav-label">选择你的下一场战斗</div>
          <nav>
            {NAV.map(({ page: p, icon: Icon, title: text }) => (
              <button
                key={p}
                aria-label={text}
                className={`nav-item ${page === p ? 'active' : ''}`}
                onClick={() => {
                  setPage(p);
                  window.scrollTo(0, 0);
                }}
              >
                <Icon size={19} />
                <span>{text}</span>
                {p === 'official' && <small>20</small>}
                {page === p && <i />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="squad-note">
              <div className="tiny-star">✦</div>
              <b>今天，也要快一点。</b>
              <p>
                没有最强阵容，
                <br />
                只有更好的出击时机。
              </p>
              <button onClick={() => setGuide(true)}>
                查看指挥官手册
                <ArrowUpRight size={14} />
              </button>
            </div>
            <button className="nav-item" aria-label="设置" onClick={() => setSettingsOpen(true)}>
              <Settings size={19} />
              <span>设置</span>
            </button>
            <button className="nav-item" aria-label="玩法指南" onClick={() => setGuide(true)}>
              <CircleHelp size={19} />
              <span>玩法指南</span>
            </button>
            <div className="local-badge">
              <span className="live-dot" />
              纯粹单机 · 纪录保存在本机
            </div>
          </div>
        </aside>
      )}
      <main className={session ? 'main-content combat' : 'main-content'}>
        {!session && (
          <header className="topbar">
            <div>
              <span className="breadcrumb">破城协议</span>
              <ChevronRight size={13} />
              <b>{title}</b>
            </div>
            <div className="topbar-right">
              <span className="version">行动 01 · 破城协议</span>
              <button
                className="icon-button"
                aria-label="声音设置"
                onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
              >
                <Volume2 size={18} opacity={settings.sound ? 1 : 0.35} />
              </button>
              <div className="commander-avatar">
                <Portrait type="commander" />
              </div>
              <span className="commander-label">机动部队指挥官</span>
            </div>
          </header>
        )}
        {session ? (
          <Suspense
            fallback={
              <div className="loading-game">
                <span className="loader" />
                正在准备你的机器人小队…
              </div>
            }
          >
            <Battle
              key={session.id}
              session={session}
              store={store}
              reducedMotion={settings.reduced}
              toast={toast}
              onExit={() => {
                setSession(null);
                setPage('official');
              }}
              onRetry={() => start(session)}
              onNext={() => {
                const index = CHALLENGES.findIndex((c) => c.id === session.challenge?.id);
                const next = (index + 1) % 20;
                start({ map: officialMaps[next], challenge: CHALLENGES[next] });
              }}
            />
          </Suspense>
        ) : (
          <div className="page-content">
            {page === 'home' && (
              <>
                <section className="hero" style={{ backgroundImage: `url("${HERO_URL}")` }}>
                  <div className="hero-copy">
                    <Badge>行动 01 / 破城协议</Badge>
                    <h2>
                      小小机器人。
                      <br />
                      <span>大大</span>破坏力。
                    </h2>
                    <p>
                      部署你的机器人小队，直击防御中枢。
                      <br />
                      每一次出击，都比上一次更快。
                    </p>
                    <div className="hero-actions">
                      <button
                        className="btn primary"
                        onClick={() =>
                          start({
                            map: officialMaps[
                              Math.max(
                                0,
                                officialMaps.findIndex((m) => !store.get(m)?.wins),
                              )
                            ],
                            challenge:
                              CHALLENGES[
                                Math.max(
                                  0,
                                  officialMaps.findIndex((m) => !store.get(m)?.wins),
                                )
                              ],
                          })
                        }
                      >
                        <Swords size={18} />
                        开始出击
                        <ArrowRight size={17} />
                      </button>
                      <button className="hero-guide" onClick={() => setGuide(true)}>
                        <span>
                          <Play size={12} fill="currentColor" />
                        </span>
                        怎么玩？
                      </button>
                    </div>
                    <div className="hero-facts">
                      <span>
                        <Clock3 size={14} />
                        210 秒极限竞速
                      </span>
                      <span>
                        <Shield size={14} />
                        原创反塔防
                      </span>
                    </div>
                  </div>
                  <div className="hero-mission">
                    <span className="live-dot" />
                    战役就绪<span>OPERATION / 001</span>
                    <b>行动代号：破晓</b>
                    <small>部署 · 突破 · 刷新纪录</small>
                  </div>
                  <div className="hero-coordinate">
                    SECTOR 07 — FRONTIER OUTPOST <span>25° 04′ N / 117° 32′ E</span>
                  </div>
                </section>
                <div className="overview-stats">
                  <Stat
                    icon={Flag}
                    color="green"
                    label="官方挑战进度"
                    value={`${completed}`}
                    suffix="/ 20"
                    extra="每一座堡垒，都有突破口"
                  />
                  <Stat
                    icon={Trophy}
                    color="purple"
                    label="累计成功突围"
                    value={`${wins}`}
                    suffix="次"
                    extra={wins ? '干得漂亮，继续刷新纪录' : '你的第一场胜利正在等你'}
                  />
                  <Stat
                    icon={Clock3}
                    color="orange"
                    label="个人最快通关"
                    value={formatTime(bestRecord?.best)}
                    extra={
                      bestRecord
                        ? (CHALLENGES.find((c) => c.seed === bestRecord.seed)?.name ?? '随机战场')
                        : '完成挑战后解锁你的纪录'
                    }
                  />
                </div>
                <SectionTitle
                  title="选择你的第一个目标"
                  subtitle="废土前哨 / 四个入门目标，开启你的攻城行动。"
                  action={
                    <button className="text-button" onClick={() => setPage('official')}>
                      全部 20 张地图
                      <ArrowRight size={15} />
                    </button>
                  }
                />
                <div className="map-grid home-maps">
                  {CHALLENGES.slice(0, 4).map((c, i) => (
                    <MapCard
                      key={c.id}
                      challenge={c}
                      map={officialMaps[i]}
                      record={store.get(officialMaps[i])}
                      index={i}
                      onClick={() => setSelection({ map: officialMaps[i], challenge: c })}
                    />
                  ))}
                </div>
                <div className="home-bottom">
                  <button className="random-banner" onClick={() => setPage('random')}>
                    <span className="random-dice">
                      <Dices size={28} />
                    </span>
                    <div>
                      <span className="kicker">UNEXPLORED SECTORS</span>
                      <h3>下一个战场，由种子决定。</h3>
                      <p>输入朋友的种子，或开启一场未知挑战。</p>
                    </div>
                    <span className="round-arrow">
                      <ArrowUpRight size={20} />
                    </span>
                  </button>
                  <div className="commander-tip">
                    <span className="tip-tag">
                      <Cpu size={14} />
                      你的机械军团
                    </span>
                    <div className="squad-preview">
                      {ZOMBIE_TYPES.map((t) => (
                        <Portrait key={t} type={t} />
                      ))}
                    </div>
                    <button className="text-button" onClick={() => setGuide(true)}>
                      六种机体，无限战术
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
            {page === 'official' && (
              <>
                <div className="page-heading">
                  <Badge>20 个种子，20 种突破方式</Badge>
                  <h1>
                    官方挑战<span className="heading-mark">.</span>
                  </h1>
                  <p>五大战区，二十个目标。观察防御设备，寻找最快的攻城路线。</p>
                </div>
                <div className="campaign-progress">
                  <span>
                    <Flag size={18} />
                    征服进度 <b>{completed} / 20</b>
                  </span>
                  <div className="meter">
                    <i style={{ width: `${completed * 5}%` }} />
                  </div>
                  <small>
                    {completed === 20
                      ? '全部突围！继续追逐 SS 纪录。'
                      : '全部地图已开放，自由选择你的下一站。'}
                  </small>
                </div>
                <div className="theme-tabs">
                  <button className={theme === -1 ? 'active' : ''} onClick={() => setTheme(-1)}>
                    全部阵地<span>20</span>
                  </button>
                  {THEMES.map((t, i) => (
                    <button
                      key={t.name}
                      className={theme === i ? 'active' : ''}
                      onClick={() => setTheme(i)}
                    >
                      {t.name}
                      <span>4</span>
                    </button>
                  ))}
                </div>
                {THEMES.map((t, tIndex) =>
                  theme === -1 || theme === tIndex ? (
                    <section className="theme-section" key={t.name}>
                      <SectionTitle
                        title={`${String(tIndex + 1).padStart(2, '0')}　${t.name}`}
                        subtitle={t.subtitle}
                      />
                      <div className="map-grid">
                        {CHALLENGES.map((c, i) =>
                          c.theme === tIndex ? (
                            <MapCard
                              key={c.id}
                              challenge={c}
                              map={officialMaps[i]}
                              record={store.get(officialMaps[i])}
                              index={i}
                              onClick={() => setSelection({ map: officialMaps[i], challenge: c })}
                            />
                          ) : null,
                        )}
                      </div>
                    </section>
                  ) : null,
                )}
              </>
            )}
            {page === 'random' && (
              <>
                <div className="page-heading">
                  <Badge>每个种子，都是一座未知堡垒</Badge>
                  <h1>
                    未知战场<span className="heading-mark">.</span>
                  </h1>
                  <p>跟随直觉探索，或输入朋友的种子，向同一座阵地发起挑战。</p>
                </div>
                <div className="random-layout">
                  <section className="seed-controls panel">
                    <div className="panel-heading">
                      <Dices size={20} />
                      <h2>准备你的挑战</h2>
                    </div>
                    <label className="field-label" htmlFor="difficulty">
                      挑战难度
                    </label>
                    <div className="difficulty-picker" id="difficulty">
                      {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          className={difficulty === d ? 'active' : ''}
                          onClick={() => regenerate(randomMap.seed, d)}
                        >
                          {DIFFICULTIES[d].name}
                        </button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        regenerate();
                      }}
                    >
                      <label className="field-label" htmlFor="seed-input">
                        地图种子
                      </label>
                      <input
                        id="seed-input"
                        value={seedInput}
                        onChange={(e) => setSeedInput(e.target.value)}
                        placeholder="MS-G1-7J2K9Q"
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <p className="field-help">相同种子 + 相同难度 = 相同阵地</p>
                      {seedError && (
                        <p className="field-error" role="alert">
                          {seedError}
                        </p>
                      )}
                      <div className="seed-button-row">
                        <button className="btn secondary" type="submit">
                          <Map size={15} />
                          预览种子
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => regenerate(newSeed())}
                        >
                          <Shuffle size={15} />
                          随机生成
                        </button>
                      </div>
                    </form>
                    <div className="seed-divider" />
                    <div className="random-note">
                      <Sparkles size={18} />
                      <p>阵地在开战后固定不变。先观察缺口，再决定你的战术。</p>
                    </div>
                    <button
                      className="btn primary full-width"
                      onClick={() =>
                        start({
                          map: randomMap,
                          challenge: CHALLENGES.find(
                            (c) =>
                              c.seed === randomMap.seed && c.difficulty === randomMap.difficulty,
                          ),
                        })
                      }
                    >
                      <Swords size={17} />
                      开始挑战
                      <ArrowRight size={17} />
                    </button>
                  </section>
                  <section className="map-detail-preview panel">
                    <div className="preview-heading">
                      <span className="eyebrow">战场侦察</span>
                      <span className={`difficulty ${randomMap.difficulty}`}>
                        {DIFFICULTIES[randomMap.difficulty].name}
                      </span>
                    </div>
                    <MapPreview map={randomMap} large />
                    <div className="preview-meta">
                      <div>
                        <h2>{STYLES[randomMap.style]}阵地</h2>
                        <p>
                          {randomMap.plants.length} 台防守防御设备 · {randomMap.terrain.length}{' '}
                          处特殊地形
                        </p>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="复制地图种子"
                        onClick={async () =>
                          toast(
                            (await copyText(formatSeed(randomMap.seed)))
                              ? '种子已复制。分享时请同时告诉朋友难度。'
                              : '无法访问剪贴板，请手动复制种子。',
                          )
                        }
                      >
                        <Copy size={17} />
                      </button>
                    </div>
                    <code className="seed-code">{formatSeed(randomMap.seed)}</code>
                    <div className="plant-roster">
                      {[...new Set(randomMap.plants.map((p) => p.type))].map((t) => (
                        <span key={t} title={PLANTS[t].description}>
                          <Portrait type={t} />
                          {PLANTS[t].name}
                        </span>
                      ))}
                    </div>
                    <Tip>
                      每张地图独立保存个人最佳。分享挑战链接时会同时包含种子、难度和规则版本。
                    </Tip>
                    <button
                      className="text-button"
                      onClick={async () =>
                        toast(
                          (await copyText(shareText(randomMap, store.get(randomMap)?.best)))
                            ? '完整挑战文本和链接已复制。'
                            : '复制失败，请检查剪贴板权限。',
                        )
                      }
                    >
                      复制完整挑战链接
                      <ArrowUpRight size={14} />
                    </button>
                  </section>
                </div>
              </>
            )}
            {page === 'records' && (
              <>
                <div className="page-heading">
                  <Badge>把每一次突破，变成新的起点</Badge>
                  <h1>
                    你的竞速档案<span className="heading-mark">.</span>
                  </h1>
                  <p>纪录与最佳战术保存在当前浏览器。重新出击，向过去的自己发起挑战。</p>
                </div>
                <div className="overview-stats">
                  <Stat
                    icon={Flag}
                    color="green"
                    label="累计挑战"
                    value={`${records.reduce((n, r) => n + r.attempts, 0)}`}
                    suffix="次"
                    extra="每一次尝试都算数"
                  />
                  <Stat
                    icon={Trophy}
                    color="purple"
                    label="成功突围"
                    value={`${wins}`}
                    suffix="次"
                    extra={`已攻克 ${completed} 张官方地图`}
                  />
                  <Stat
                    icon={Clock3}
                    color="orange"
                    label="全局最快"
                    value={formatTime(bestRecord?.best)}
                    extra="以模拟时间计时"
                  />
                </div>
                {records.length ? (
                  <div className="records-list panel">
                    <div className="record-table-heading">
                      <span>挑战地图</span>
                      <span>个人最佳 / 评级</span>
                      <span>成功 / 挑战</span>
                      <span>再次出发</span>
                    </div>
                    {records.map((r) => {
                      const c = CHALLENGES.find(
                        (c) => c.seed === r.seed && c.difficulty === r.difficulty,
                      );
                      return (
                        <details
                          className="record-entry"
                          key={`${formatSeed(r.seed)}:${r.difficulty}:${r.rulesVersion}`}
                        >
                          <summary>
                            <div>
                              <b>{c?.name ?? '未命名战区'}</b>
                              <small>
                                {formatSeed(r.seed)} ·{' '}
                                {DIFFICULTIES[r.difficulty]?.name ?? r.difficulty}
                              </small>
                            </div>
                            <span className="record-time">
                              {formatTime(r.best)}{' '}
                              {r.grade && <b className="mini-grade">{r.grade}</b>}
                            </span>
                            <span>
                              {r.wins} / {r.attempts}
                            </span>
                            <span className="record-buttons">
                              <button
                                className="icon-button"
                                aria-label={`重放${c?.name ?? r.seed}最佳战斗`}
                                disabled={!r.replay}
                                onClick={(e) => {
                                  e.preventDefault();
                                  showReplay(r);
                                }}
                              >
                                <Play size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`重新挑战${c?.name ?? r.seed}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  start({ map: generateMap(r.seed, r.difficulty), challenge: c });
                                }}
                              >
                                <ArrowRight size={17} />
                              </button>
                            </span>
                          </summary>
                          <div className="record-history">
                            <h4>最近通关纪录（最多保留 30 次）</h4>
                            {r.history.length ? (
                              r.history.map((h, i) => (
                                <div key={i}>
                                  <span>{new Date(h.date).toLocaleString('zh-CN')}</span>
                                  <b>{formatTime(h.ticks)}</b>
                                  <span>{h.grade}</span>
                                </div>
                              ))
                            ) : (
                              <p>尚未通关，继续挑战吧。</p>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                ) : (
                  <div className="panel">
                    <EmptyRecord />
                    <button className="btn primary empty-cta" onClick={() => setPage('official')}>
                      <Flag size={16} />
                      去创造第一个纪录
                    </button>
                  </div>
                )}
                <Tip>只有真实通关会保存成绩。最佳战斗可以回放，暂停与回放不会改变你的纪录。</Tip>
              </>
            )}
            <footer className="footer">
              <span>
                <Cpu size={14} />
                机械围城 · 从另一边，改变战局。
              </span>
              <span>原创反塔防竞速 · 本地版 1.0</span>
            </footer>
          </div>
        )}
      </main>
      {selection && (
        <Dialog title="战前侦察" onClose={() => setSelection(null)}>
          <MapPreview map={selection.map} large />
          <div className="selection-heading">
            <div>
              <span className="kicker">
                {selection.challenge ? THEMES[selection.challenge.theme].name : '未知战场'}
              </span>
              <h2>{selection.challenge?.name ?? '种子挑战'}</h2>
            </div>
            <span className={`difficulty ${selection.map.difficulty}`}>
              {DIFFICULTIES[selection.map.difficulty].name}
            </span>
          </div>
          <p className="selection-description">{selection.challenge?.description}</p>
          <div className="selection-stats">
            <div>
              <span>核心生命</span>
              <b>450 HP</b>
            </div>
            <div>
              <span>时限</span>
              <b>210 秒</b>
            </div>
            <div>
              <span>历史最佳</span>
              <b>{formatTime(store.get(selection.map)?.best)}</b>
            </div>
          </div>
          <div className="plant-roster">
            {[...new Set(selection.map.plants.map((p) => p.type))].map((t) => (
              <span key={t} title={PLANTS[t].description}>
                <Portrait type={t} />
                {PLANTS[t].name}
              </span>
            ))}
          </div>
          {selection.challenge && (
            <div className="grade-targets">
              {Object.entries(selection.challenge.thresholds).map(([g, t]) => (
                <span key={g}>
                  <b>{g}</b> ≤ {formatTime(t)}
                </span>
              ))}
            </div>
          )}
          <button className="btn primary full-width" onClick={() => start(selection)}>
            <Swords size={17} />
            部署小队，开始挑战
            <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
      {settingsOpen && (
        <Dialog title="游戏设置" onClose={() => setSettingsOpen(false)}>
          <div className="setting-row">
            <div>
              <b>战斗音效</b>
              <p>原创合成音效，无外部音频资源。</p>
            </div>
            <button
              className={`switch ${settings.sound ? 'on' : ''}`}
              role="switch"
              aria-checked={settings.sound}
              aria-label="战斗音效"
              onClick={() => setSettings((s) => ({ ...s, sound: !s.sound }))}
            >
              <i />
            </button>
          </div>
          <div className="setting-row">
            <label htmlFor="volume">
              <b>音量</b>
              <p>{Math.round(settings.volume * 100)}%</p>
            </label>
            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={settings.volume}
              onChange={(e) => setSettings((s) => ({ ...s, volume: Number(e.target.value) }))}
            />
          </div>
          <div className="setting-row">
            <div>
              <b>减少动态效果</b>
              <p>关闭角色摆动，保留必要战斗反馈。</p>
            </div>
            <button
              className={`switch ${settings.reduced ? 'on' : ''}`}
              role="switch"
              aria-checked={settings.reduced}
              aria-label="减少动态效果"
              onClick={() => setSettings((s) => ({ ...s, reduced: !s.reduced }))}
            >
              <i />
            </button>
          </div>
          <Tip>暂停会冻结模拟计时。切换到其他标签页时游戏会自动暂停，返回后手动继续。</Tip>
          <button className="btn primary full-width" onClick={() => setSettingsOpen(false)}>
            <Check size={16} />
            完成
          </button>
        </Dialog>
      )}
      {guide && (
        <Dialog title="指挥官手册" onClose={() => setGuide(false)}>
          <div className="guide-intro">
            <BookOpen size={25} />
            <p>
              你负责出兵，机器人自动移动与攻击。<b>210 秒内</b>摧毁右侧防御中枢，越快越好！
            </p>
          </div>
          <div className="guide-steps">
            <div>
              <span>1</span>
              <b>选择兵种</b>
              <p>点击卡牌或按 1–6，留意电能与独立冷却。</p>
            </div>
            <div>
              <span>2</span>
              <b>选择路线</b>
              <p>点击战场任意路线出兵。集中进攻薄弱路线更有效。</p>
            </div>
            <div>
              <span>3</span>
              <b>刷新纪录</b>
              <p>通关保存最佳战术，再挑战同一种子，寻找更快的配合。</p>
            </div>
          </div>
          <h3 className="guide-heading">认识你的机器人小队</h3>
          <div className="guide-units">
            {ZOMBIE_TYPES.map((t) => (
              <div key={t}>
                <Portrait type={t} />
                <div>
                  <b>
                    {ZOMBIES[t].name}
                    <small>
                      <Zap size={11} />
                      {ZOMBIES[t].cost}
                    </small>
                  </b>
                  <p>{ZOMBIES[t].description}</p>
                </div>
              </div>
            ))}
          </div>
          <h3 className="guide-heading">读懂防御设备与地形</h3>
          <div className="guide-plants">
            {Object.entries(PLANTS).map(([key, p]) => (
              <div key={key}>
                <Portrait type={key as keyof typeof PLANTS} />
                <p>
                  <b>{p.name}</b>
                  {p.description}
                </p>
              </div>
            ))}
          </div>
          <div className="terrain-guide">
            {Object.values(TERRAIN_INFO).map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
          <Tip>同一种子还需要选择相同难度才能复现。使用“完整挑战链接”分享最方便。</Tip>
          <button className="btn primary full-width" onClick={() => setGuide(false)}>
            明白了，准备出击
            <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
      {notification && (
        <div className="toast" role="status">
          <Sparkles size={17} />
          {notification}
        </div>
      )}
    </div>
  );
}
function Stat({
  icon: Icon,
  color,
  label,
  value,
  suffix,
  extra,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
  suffix?: string;
  extra: string;
}) {
  return (
    <div className="stat">
      <div className={`stat-icon ${color}`}>
        <Icon size={21} />
      </div>
      <div>
        <span>{label}</span>
        <strong>
          {value}
          <small>{suffix}</small>
        </strong>
        <p>{extra}</p>
      </div>
    </div>
  );
}
