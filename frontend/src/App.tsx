import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PlayableTrack, UpNextItem, DownloadItem, Stats, TrackContext } from '@smartcrate/shared';
import { getQueue, rate, undo, recommend, getDownloads, getStats, getTrackContext } from './api';
import { useYouTubePlayer } from './youtube';
import { StatsView } from './Stats';
import { TrackInfoPanel } from './Info';

type Status = 'idle' | 'loading' | 'playing' | 'empty' | 'exhausted' | 'seeding' | 'error';
type Nav = { current: PlayableTrack | null; back: PlayableTrack[]; forward: PlayableTrack[] };

const C = {
  bg: '#0b0b0d', panel: '#17171b', border: '#2a2a30', text: '#ececee',
  muted: '#86868f', accent: '#9fef00', red: '#ff4d5e', shadow: '0 6px 20px rgba(0,0,0,.45)',
};
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const PLACEHOLDER_REASON = 'seed/exploration';

export function App() {
  const [started, setStarted] = useState(false);
  const [nav, setNav] = useState<Nav>({ current: null, back: [], forward: [] });
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [paused, setPaused] = useState(false);
  const [lastRating, setLastRating] = useState<{ trackId: string; value: 'like' | 'dislike' } | null>(null);
  const [flash, setFlash] = useState<'like' | 'dislike' | null>(null);
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState<TrackContext | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);

  const current = nav.current;
  const player = useYouTubePlayer(() => void skip()); // auto-advance on track end

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

  // Reset the info panel when the track changes.
  useEffect(() => {
    setInfoOpen(false);
    setInfo(null);
  }, [current?.track.id]);

  async function toggleInfo() {
    if (infoOpen) {
      setInfoOpen(false);
      return;
    }
    setInfoOpen(true);
    if (!info && current) {
      setInfoLoading(true);
      try {
        setInfo(await getTrackContext(current.track.id));
      } catch {
        setInfo(null);
      }
      setInfoLoading(false);
    }
  }

  const refreshDownloads = () => void getDownloads().then(setDownloads).catch(() => undefined);
  const refreshStats = () => void getStats().then(setStats).catch(() => undefined);
  const flashBtn = (k: 'like' | 'dislike') => {
    setFlash(k);
    setTimeout(() => setFlash(null), 350);
  };

  /** Fetch the front-of-queue track, generating recommendations if empty. */
  async function nextFromQueue(): Promise<PlayableTrack | null> {
    let state = await getQueue();
    if (!state.current) {
      const res = await recommend();
      if (res.seedingRequired) {
        setStatus('seeding');
        return null;
      }
      state = await getQueue();
    }
    setUpNext(state.upNext);
    return state.current;
  }

  /** Advance to a brand-new track: push current onto the back-stack, clear forward. */
  const goTo = (t: PlayableTrack | null) =>
    setNav((n) => (t ? { current: t, back: n.current ? [...n.back, n.current] : n.back, forward: [] } : n));

  async function start() {
    setStarted(true);
    setStatus('loading');
    setMessage('');
    try {
      const t = await nextFromQueue();
      if (t) {
        goTo(t);
        setStatus('playing');
      } else setStatus((s) => (s === 'seeding' ? s : 'empty'));
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message);
    }
  }

  async function advanceToNext() {
    try {
      const t = await nextFromQueue();
      if (t) {
        goTo(t);
        setStatus('playing');
      } else setStatus((s) => (s === 'seeding' ? s : 'exhausted'));
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message);
    }
  }

  async function like() {
    const id = current?.track.id;
    if (!id) return;
    flashBtn('like');
    await rate(id, 'like'); // stays on the current track
    setLastRating({ trackId: id, value: 'like' });
    refreshDownloads();
    refreshStats();
  }

  async function dislike() {
    const id = current?.track.id;
    if (!id) return;
    flashBtn('dislike');
    await rate(id, 'dislike');
    setLastRating({ trackId: id, value: 'dislike' });
    refreshStats();
    await advanceToNext();
  }

  async function skip() {
    const id = current?.track.id;
    if (!id) return;
    setLastRating(null); // transport, not a rating
    await rate(id, 'skip');
    await advanceToNext();
  }

  function back() {
    setLastRating(null);
    setNav((n) =>
      n.back.length
        ? { current: n.back[n.back.length - 1]!, back: n.back.slice(0, -1), forward: n.current ? [n.current, ...n.forward] : n.forward }
        : n,
    );
  }

  async function next() {
    setLastRating(null);
    if (nav.forward.length) {
      setNav((n) => ({ current: n.forward[0]!, back: n.current ? [...n.back, n.current] : n.back, forward: n.forward.slice(1) }));
    } else {
      await skip(); // at the live edge → real skip
    }
  }

  async function undoLast() {
    if (!lastRating) return;
    const { value, trackId } = lastRating;
    const res = await undo(trackId);
    refreshDownloads();
    refreshStats();
    if (value === 'dislike' && res.current) {
      // bring the undone track back as current (the present track moves to forward)
      setNav((n) => ({ current: res.current, back: n.back, forward: n.current ? [n.current, ...n.forward] : n.forward }));
      setStatus('playing');
    }
    setLastRating(null);
  }

  async function share() {
    const id = current?.track.youtubeVideoId;
    if (!id) return;
    const t = Math.floor(player.getCurrentTime());
    await navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${id}&t=${t}s`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
            <div ref={player.containerRef} className="sc-player" style={s.player} />
          </div>
        </div>

        {!started && <button style={s.play} onClick={() => void start()}>▶ Play</button>}
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
              <button style={s.btn} onClick={back} disabled={nav.back.length === 0} title="Back">⏮</button>
              <button style={s.btn} onClick={togglePlay}>{paused ? '▶' : '⏸'}</button>
              <button style={flash === 'like' ? s.likeFlash : s.like} onClick={() => void like()}>♥ Like</button>
              <button style={flash === 'dislike' ? s.dislikeFlash : s.dislike} onClick={() => void dislike()}>✕ Dislike</button>
              <button style={s.btn} onClick={() => void next()} title="Next / Skip">⏭</button>
              <button style={s.btn} onClick={() => void share()}>{copied ? '✓ Copied' : '⤴ Share'}</button>
              <button style={infoOpen ? s.btnActive : s.btn} onClick={() => void toggleInfo()}>ⓘ Info</button>
              {lastRating && (
                <button style={s.undo} onClick={() => void undoLast()}>↩ Undo {lastRating.value}</button>
              )}
            </div>
          </>
        )}
      </section>

      {started && infoOpen && <TrackInfoPanel ctx={info} loading={infoLoading} />}

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
  background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: C.shadow,
};
const ctrl: CSSProperties = { padding: '10px 14px', cursor: 'pointer', borderRadius: 10, background: '#202027', color: C.text, border: `1px solid ${C.border}`, transition: 'all .12s' };

const s: Record<string, CSSProperties> = {
  main: { maxWidth: 640, margin: '0 auto', padding: '24px 16px 64px', color: C.text },
  header: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 },
  logo: { fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: 1 },
  tagline: { color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2 },
  card,
  hero: { ...card, padding: 20 },
  playerWrap: { maxWidth: 360, margin: '0 auto' },
  player: { border: `1px solid ${C.border}` },
  play: { fontFamily: MONO, fontSize: 18, padding: '12px 28px', cursor: 'pointer', borderRadius: 10, background: C.accent, color: '#000', border: 'none', fontWeight: 700 },
  title: { fontFamily: MONO, margin: '18px 0 6px', fontSize: 30, fontWeight: 700, lineHeight: 1.1 },
  meta: { color: C.text, fontSize: 14 },
  va: { color: C.accent, fontWeight: 700, marginLeft: 4, fontFamily: MONO },
  reason: { color: C.muted, fontSize: 12, marginTop: 6 },
  controls: { display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' },
  btn: ctrl,
  btnActive: { ...ctrl, borderColor: C.accent, color: C.accent },
  like: { ...ctrl, padding: '10px 18px', background: C.accent, color: '#000', border: 'none', fontWeight: 700 },
  likeFlash: { ...ctrl, padding: '10px 18px', background: '#d4ff66', color: '#000', border: 'none', fontWeight: 700, transform: 'scale(1.06)' },
  dislike: { ...ctrl, background: 'transparent', color: C.red, border: `1px solid ${C.red}` },
  dislikeFlash: { ...ctrl, background: C.red, color: '#fff', border: `1px solid ${C.red}`, transform: 'scale(1.06)' },
  undo: { ...ctrl, color: C.muted, fontSize: 13 },
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
