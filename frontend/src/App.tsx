import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PlayableTrack, UpNextItem, DownloadItem, Stats } from '@smartcrate/shared';
import { getQueue, rate, recommend, getDownloads, getStats, type RateAction } from './api';
import { useYouTubePlayer } from './youtube';
import { StatsView } from './Stats';

type Status = 'idle' | 'loading' | 'playing' | 'empty' | 'exhausted' | 'seeding' | 'error';

const C = {
  bg: '#0b0b0d',
  panel: '#17171b',
  border: '#2a2a30',
  text: '#ececee',
  muted: '#86868f',
  accent: '#9fef00',
  red: '#ff4d5e',
  shadow: '0 6px 20px rgba(0,0,0,.45)',
};
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const PLACEHOLDER_REASON = 'seed/exploration';

export function App() {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [paused, setPaused] = useState(false);

  const player = useYouTubePlayer(() => void advance('skip'));

  useEffect(() => {
    if (current?.track.youtubeVideoId && player.ready) {
      player.load(current.track.youtubeVideoId);
      setPaused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.track.id, player.ready]);

  useEffect(() => {
    refreshStats();
    refreshDownloads();
  }, []);

  const refreshDownloads = () => void getDownloads().then(setDownloads).catch(() => undefined);
  const refreshStats = () => void getStats().then(setStats).catch(() => undefined);

  async function syncQueue(): Promise<PlayableTrack | null> {
    let state = await getQueue();
    if (!state.current) {
      const res = await recommend();
      if (res.seedingRequired) {
        setStatus('seeding');
        setCurrent(null);
        setUpNext([]);
        return null;
      }
      state = await getQueue();
    }
    setCurrent(state.current);
    setUpNext(state.upNext);
    return state.current;
  }

  async function start() {
    setStarted(true);
    setStatus('loading');
    setMessage('');
    try {
      const next = await syncQueue();
      setStatus((s) => (next ? 'playing' : s === 'seeding' ? s : 'empty'));
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message);
    }
  }

  async function advance(value: RateAction) {
    const track = current?.track.id;
    if (!track) return;
    try {
      await rate(track, value);
      refreshDownloads();
      refreshStats();
      const next = await syncQueue();
      setStatus((s) => (next ? 'playing' : s === 'seeding' ? s : 'exhausted'));
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message);
    }
  }

  function togglePlay() {
    if (paused) player.play();
    else player.pause();
    setPaused(!paused);
  }

  const realReason = current && current.reason !== PLACEHOLDER_REASON ? current.reason : '';

  return (
    <main style={s.main}>
      <header style={s.header}>
        <span style={s.logo}>smartcrate</span>
        <span style={s.tagline}>techno curation</span>
      </header>

      <section style={s.hero}>
        <div style={{ display: started ? 'block' : 'none' }}>
          <div style={s.playerWrap}>
            <div ref={player.containerRef} style={s.player} />
          </div>
        </div>

        {!started && (
          <button style={s.play} onClick={() => void start()}>▶ Play</button>
        )}

        {started && status === 'loading' && <p style={s.muted}>Loading…</p>}

        {started && status === 'seeding' && (
          <p style={s.notice}>
            No signal yet and no seeds resolved. Add labels/artists to <code>config/seeds.json</code>, then{' '}
            <button style={s.ghost} onClick={() => void start()}>Refill</button>.
          </p>
        )}

        {started && (status === 'empty' || status === 'exhausted') && (
          <p style={s.notice}>
            {status === 'exhausted' ? 'Queue exhausted.' : 'Nothing to play yet.'}{' '}
            <button style={s.ghost} onClick={() => void start()}>Refill</button>
          </p>
        )}

        {started && status === 'error' && <p style={{ color: C.red }}>Error: {message}</p>}

        {current && status === 'playing' && (
          <>
            <h2 style={s.title}><span className="sc-live" />{current.track.title}</h2>
            <div style={s.meta}>
              {current.artists.map((a) => a.name).join(', ') || 'Unknown artist'}
              {current.labels.length > 0 && <> · {current.labels.map((l) => l.name).join(', ')}</>}
              {current.release.isVa && <span style={s.va}> VA</span>}
            </div>
            {realReason && <div style={s.reason}>{realReason}</div>}

            <div style={s.controls}>
              <button style={s.btn} onClick={togglePlay}>{paused ? '▶' : '⏸'}</button>
              <button style={s.like} onClick={() => void advance('like')}>♥ Like</button>
              <button style={s.dislike} onClick={() => void advance('dislike')}>✕ Dislike</button>
              <button style={s.btn} onClick={() => void advance('skip')}>⏭ Skip</button>
            </div>
          </>
        )}
      </section>

      {started && upNext.length > 0 && (
        <section style={s.card}>
          <h3 style={s.h3}>Up next</h3>
          {groupByArtist(upNext.slice(0, 16)).map((g, gi) => (
            <div key={gi} style={s.group}>
              <div style={s.groupArtist}>{g.artist}</div>
              {g.tracks.map((t) => (
                <div key={t.trackId} style={s.upRow}>
                  <span style={s.upTitle}>{t.title}</span>
                  <Score n={t.score} />
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {downloads.length > 0 && (
        <section style={s.card}>
          <h3 style={s.h3}>Downloads</h3>
          {downloads.slice(0, 8).map((d) => (
            <div key={d.id} style={s.dlRow}>
              <span style={s.upTitle}>{fileName(d)}</span>
              <span style={d.status === 'failed' ? { color: C.red } : s.muted}>{d.status}</span>
            </div>
          ))}
        </section>
      )}

      <section style={s.card}>
        <h3 style={s.h3}>Stats</h3>
        <StatsView stats={stats} />
      </section>
    </main>
  );
}

function Score({ n }: { n: number }) {
  return n > 0 ? <span style={s.score}>{n.toFixed(1)}</span> : <span style={s.scoreZero}>—</span>;
}

function groupByArtist(items: UpNextItem[]): Array<{ artist: string; tracks: UpNextItem[] }> {
  const groups: Array<{ artist: string; tracks: UpNextItem[] }> = [];
  for (const it of items) {
    const artist = it.artists.join(', ') || '—';
    const last = groups[groups.length - 1];
    if (last && last.artist === artist) last.tracks.push(it);
    else groups.push({ artist, tracks: [it] });
  }
  return groups;
}

function fileName(d: DownloadItem): string {
  return d.filePath ? (d.filePath.split('/').pop() ?? d.trackId) : d.trackId;
}

const card: CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 16,
  marginBottom: 14,
  boxShadow: C.shadow,
};

const s: Record<string, CSSProperties> = {
  main: { maxWidth: 640, margin: '0 auto', padding: '24px 16px 64px', color: C.text },
  header: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 },
  logo: { fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: 1 },
  tagline: { color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2 },
  card,
  hero: { ...card, padding: 20 },
  playerWrap: { maxWidth: 360, margin: '0 auto' },
  player: { background: '#000', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, minHeight: 150 },
  play: { fontFamily: MONO, fontSize: 18, padding: '12px 28px', cursor: 'pointer', borderRadius: 10, background: C.accent, color: '#000', border: 'none', fontWeight: 700 },
  title: { fontFamily: MONO, margin: '18px 0 6px', fontSize: 30, fontWeight: 700, lineHeight: 1.1 },
  meta: { color: C.text, fontSize: 14 },
  va: { color: C.accent, fontWeight: 700, marginLeft: 4, fontFamily: MONO },
  reason: { color: C.muted, fontSize: 12, marginTop: 6 },
  controls: { display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' },
  btn: { padding: '10px 14px', cursor: 'pointer', borderRadius: 10, background: '#202027', color: C.text, border: `1px solid ${C.border}`, transition: 'background .15s' },
  like: { padding: '10px 18px', cursor: 'pointer', borderRadius: 10, background: C.accent, color: '#000', border: 'none', fontWeight: 700 },
  dislike: { padding: '10px 16px', cursor: 'pointer', borderRadius: 10, background: 'transparent', color: C.red, border: `1px solid ${C.red}` },
  h3: { margin: '0 0 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted },
  group: { marginBottom: 10 },
  groupArtist: { color: C.muted, fontSize: 12, marginBottom: 2 },
  upRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0 4px 12px', fontSize: 13 },
  upTitle: { fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dlRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 13 },
  score: { fontFamily: MONO, color: C.accent, fontVariantNumeric: 'tabular-nums' },
  scoreZero: { fontFamily: MONO, color: C.muted, fontVariantNumeric: 'tabular-nums' },
  muted: { color: C.muted },
  notice: { background: '#1f1f25', padding: 12, borderRadius: 10, color: C.text, fontSize: 13 },
  ghost: { marginLeft: 6, padding: '4px 10px', cursor: 'pointer', background: 'transparent', color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8 },
};
