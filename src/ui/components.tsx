import { useEffect, useRef } from 'react';
import { ArrowUpRight, Check, Copy, Flag, Cpu, Trophy } from 'lucide-react';
import { actorUrl, actorName, UNIT_VISUALS, actorPose, environmentUrl } from '../render/art';
import type { ActorType } from '../render/art';
import { CORE_POSITION, fieldPoint } from '../render/battlefield';
import { DIFFICULTIES, PLANTS, STYLES, TERRAIN_INFO } from '../game/config';
import type { Challenge, GameMap } from '../game/types';
import { formatTime } from '../game/challenges';
import type { PersonalRecord } from '../game/records';
export function Portrait({ type, className = '' }: { type: ActorType; className?: string }) {
  return (
    <span
      role="img"
      aria-label={actorName(type)}
      className={`portrait ${className}`}
      style={{
        backgroundImage: `url("${actorUrl(type)}")`,
        backgroundSize: `${UNIT_VISUALS[type].columns * 100}% ${UNIT_VISUALS[type].rows * 100}%`,
      }}
    />
  );
}
function PreviewActor({
  type,
  x,
  y,
  scale = 1,
}: {
  type: ActorType;
  x: number;
  y: number;
  scale?: number;
}) {
  const visual = UNIT_VISUALS[type],
    pose = actorPose(type, 0, scale);
  return (
    <svg
      x={x - pose.width * pose.originX}
      y={y - pose.height * pose.originY}
      width={pose.width}
      height={pose.height}
      viewBox={`0 0 ${visual.frameWidth} ${visual.frameHeight}`}
      overflow="hidden"
    >
      <image
        href={actorUrl(type)}
        width={visual.frameWidth * visual.columns}
        height={visual.frameHeight * visual.rows}
      />
    </svg>
  );
}
export function MapPreview({ map, large = false }: { map: GameMap; large?: boolean }) {
  return (
    <div className={`map-preview ${large ? 'large' : ''}`}>
      <svg
        viewBox="0 0 1200 675"
        role="img"
        aria-label={`${STYLES[map.style]}，${map.plants.length} 台防御设备，5 条路线`}
      >
        <image href={environmentUrl(map)} width="1200" height="675" preserveAspectRatio="none" />
        {map.terrain.map((t) => {
          const p = fieldPoint(t.col + 0.5, t.row);
          return (
            <g key={`${t.row}-${t.col}`}>
              <title>{TERRAIN_INFO[t.type]}</title>
              <ellipse
                cx={p.x}
                cy={p.y - 5}
                rx={26 * p.scale}
                ry="10"
                fill={
                  {
                    mud: '#448b90',
                    road: '#e3b16a',
                    tunnel: '#152938',
                    rock: '#53616b',
                    trap: '#c47652',
                  }[t.type]
                }
                opacity="0.65"
              />
            </g>
          );
        })}
        {map.plants.map((p) => {
          const point = fieldPoint(p.col + 0.5, p.row);
          return (
            <g key={p.id}>
              <title>
                {PLANTS[p.type].name}：{PLANTS[p.type].description}
              </title>
              <ellipse cx={point.x + 6} cy={point.y} rx="27" ry="7" fill="#111b24" opacity="0.4" />
              <PreviewActor type={p.type} x={point.x} y={point.y} scale={point.scale} />
            </g>
          );
        })}
        <PreviewActor type="core" {...CORE_POSITION} />
      </svg>
    </div>
  );
}
export function MapCard({
  challenge,
  map,
  record,
  onClick,
  index,
}: {
  challenge: Challenge;
  map: GameMap;
  record?: PersonalRecord;
  onClick: () => void;
  index: number;
}) {
  return (
    <button className="map-card" onClick={onClick}>
      <div className="map-card-image">
        <MapPreview map={map} />
        <span className={`difficulty ${challenge.difficulty}`}>
          {DIFFICULTIES[challenge.difficulty].name}
        </span>
        <span className="map-number">{String(index + 1).padStart(2, '0')}</span>
        {record?.wins ? (
          <span className="completed">
            <Check size={12} />
            已通关
          </span>
        ) : null}
      </div>
      <div className="map-card-content">
        <div className="map-card-title">
          <h3>{challenge.name}</h3>
          <ArrowUpRight size={17} />
        </div>
        <p>
          {STYLES[map.style]} <span>·</span> {map.plants.length} 台防御设备
        </p>
        <div className="map-card-record">
          <span>
            <Trophy size={13} />
            {record?.best ? formatTime(record.best) : '等待你的首个纪录'}
          </span>
          {record?.grade && <b className="mini-grade">{record.grade}</b>}
        </div>
      </div>
    </button>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="eyebrow">
      <span />
      {children}
    </span>
  );
}
export function EmptyRecord() {
  return (
    <div className="empty-record">
      <div className="empty-icon">
        <Flag size={26} />
      </div>
      <h3>每个传奇，都从第一次出发</h3>
      <p>完成一场挑战，你的最快纪录会出现在这里。</p>
    </div>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,a,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
export function CopyButton({
  text,
  label = '复制种子',
  onResult,
}: {
  text: string;
  label?: string;
  onResult: (value: boolean) => void;
}) {
  return (
    <button className="btn secondary small" onClick={async () => onResult(await copyText(text))}>
      <Copy size={15} />
      {label}
    </button>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="tip">
      <Cpu size={17} />
      <span>{children}</span>
    </div>
  );
}
