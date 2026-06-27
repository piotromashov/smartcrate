import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PlayableTrack, UpNextItem, DownloadItem, Stats } from '@smartcrate/shared';
import { getQueue, rate, recommend, getDownloads, getStats, type RateAction } from './api';
import { useYouTubePlayer } from './youtube';
import { StatsView } from './Stats';

type Status = 'idle' | 'loading' | 'playing' | 'empty' | 'exhausted' | 'seeding' | 'error';

const C = {
  bg: '#0b0b0d',
  panel: '#141417',
  border: '#26262b',
  text: '#ececee',
  muted: '#86868f',
  accent: '#9fef00', // acid techno green, used sparingly
  red: '#ff4d5e',
};

export function App() {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [paused, setPaused] = useState(false);

  const player = useYouTubePlayer(() => void advance('skip')); // auto-advance on track end

  // Reload the embedded video only when the current track id changes.
  useEffect(() => {
    if (current?.track.youtubeVideoId && player.ready) {
      player.load(current.track.youtubeVideoId);
      setPaused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.track.id, player.ready]);

  // Stats + downloads load once on mount.
  useEffect(() => {
    refreshStats();
    refreshDownloads();
  }, []);

  const refreshDownloads = () => void getDownloads().then(setDownloads).catch(() => undefined);
  const refreshStats = () => void getStats().then(setStats).catch(() => undefined);

  // Sync current + up-next from the backend, refilling via recommend if empty.
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
      await rate(track, value); // like keeps the current track; dislike/skip advance
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

  return (
    <main style={s.main}>
      <header style={s.header}>
        <span style={s.logo}>smartcrate</span>
        <span style={s.tagline}>techno curation</span>
      </header>

      <section style={s.card}>
        <div style={{ display: started ? 'block' : 'none' }}>
          <div ref={player.containerRef} style={s.player} />
        </div>

        {!started && (
          <button style={s.play} onClick={() => void start()}>
            ▶ Play
          </button>
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
            <h2 style={s.title}>{current.track.title}</h2>
            <div style={s.meta}>
              {current.artists.map((a) => a.name).join(', ') || 'Unknown artist'}
              {current.labels.length > 0 && <> · {current.labels.map((l) => l.name).join(', ')}</>}
              {current.release.isVa && <span style={s.va}> VA</span>}
            </div>
            <div style={s.reason}>{current.reason}</div>

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
          <ol style={s.upNext}>
            {upNext.slice(0, 12).map((u) => (
              <li key={u.trackId} style={s.upRow}>
                <span style={s.upText}>
                  <span style={s.muted}>{u.artists.join(', ') || '—'}</span> · {u.title}
                </span>
                <span style={s.score}>{u.score.toFixed(1)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {downloads.length > 0 && (
        <section style={s.card}>
          <h3 style={s.h3}>Downloads</h3>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {downloads.slice(0, 8).map((d) => (
              <li key={d.id} style={s.dlRow}>
                <span style={s.upText}>{fileName(d)}</span>
                <span style={d.status === 'failed' ? { color: C.red } : s.muted}>{d.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={s.card}>
        <h3 style={s.h3}>Stats</h3>
        <StatsView stats={stats} />
      </section>
    </main>
  );
}

function fileName(d: DownloadItem): string {
  if (d.filePath) return d.filePath.split('/').pop() ?? d.trackId;
  return d.trackId;
}

const s: Record<string, CSSProperties> = {
  main: { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', maxWidth: 640, margin: '0 auto', padding: '24px 16px 64px', color: C.text },
  header: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 },
  logo: { fontSize: 22, fontWeight: 700, letterSpacing: 1 },
  tagline: { color: C.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 },
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 14 },
  player: { background: '#000', borderRadius: 8, overflow: 'hidden', minHeight: 160 },
  play: { fontSize: 18, padding: '12px 28px', cursor: 'pointer', borderRadius: 8, background: C.accent, color: '#000', border: 'none', fontWeight: 700 },
  title: { margin: '14px 0 4px', fontSize: 20 },
  meta: { color: C.text, fontSize: 14 },
  va: { color: C.accent, fontWeight: 700, marginLeft: 4 },
  reason: { color: C.muted, fontSize: 12, marginTop: 4 },
  controls: { display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  btn: { padding: '10px 14px', cursor: 'pointer', borderRadius: 8, background: '#1f1f25', color: C.text, border: `1px solid ${C.border}` },
  like: { padding: '10px 16px', cursor: 'pointer', borderRadius: 8, background: C.accent, color: '#000', border: 'none', fontWeight: 700 },
  dislike: { padding: '10px 16px', cursor: 'pointer', borderRadius: 8, background: 'transparent', color: C.red, border: `1px solid ${C.red}` },
  h3: { margin: '0 0 10px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted },
  upNext: { margin: 0, padding: 0, listStyle: 'none' },
  upRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 },
  dlRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 13 },
  upText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  score: { color: C.accent, fontVariantNumeric: 'tabular-nums' },
  muted: { color: C.muted },
  notice: { background: '#1b1b20', padding: 12, borderRadius: 8, color: C.text, fontSize: 13 },
  ghost: { marginLeft: 6, padding: '4px 10px', cursor: 'pointer', background: 'transparent', color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 6 },
};
