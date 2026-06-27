import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PlayableTrack, DownloadItem } from '@smartcrate/shared';
import { getQueue, rate, recommend, getDownloads, type RateAction } from './api';
import { useYouTubePlayer } from './youtube';

type Status = 'idle' | 'loading' | 'playing' | 'empty' | 'exhausted' | 'seeding' | 'error';

export function App() {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<PlayableTrack | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [paused, setPaused] = useState(false);

  const player = useYouTubePlayer(() => {
    void advance('skip'); // auto-advance when a track ends
  });

  // Load the current video whenever it changes and the player is ready.
  useEffect(() => {
    if (current?.track.youtubeVideoId && player.ready) {
      player.load(current.track.youtubeVideoId);
      setPaused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.track.id, player.ready]);

  const refreshDownloads = () => {
    void getDownloads().then(setDownloads).catch(() => undefined);
  };

  // Fetch the current track, generating recommendations if the queue is empty.
  async function fillIfEmpty(): Promise<PlayableTrack | null> {
    let state = await getQueue();
    if (!state.current) {
      const res = await recommend();
      if (res.seedingRequired) {
        setStatus('seeding');
        return null;
      }
      state = await getQueue();
    }
    return state.current;
  }

  async function start() {
    setStarted(true);
    setStatus('loading');
    setMessage('');
    try {
      const next = await fillIfEmpty();
      if (next) {
        setCurrent(next);
        setStatus('playing');
      } else {
        setStatus((s) => (s === 'seeding' ? s : 'empty'));
      }
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message);
    }
    refreshDownloads();
  }

  async function advance(value: RateAction) {
    const track = current?.track.id;
    if (!track) return;
    try {
      const { current: next } = await rate(track, value);
      refreshDownloads();
      if (next) {
        setCurrent(next);
        setStatus('playing');
        return;
      }
      const refilled = await fillIfEmpty();
      if (refilled) {
        setCurrent(refilled);
        setStatus('playing');
      } else {
        setCurrent(null);
        setStatus((s) => (s === 'seeding' ? s : 'exhausted'));
      }
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message);
    }
  }

  function togglePlay() {
    if (paused) {
      player.play();
      setPaused(false);
    } else {
      player.pause();
      setPaused(true);
    }
  }

  return (
    <main style={styles.main}>
      <h1 style={{ marginBottom: 4 }}>smartcrate</h1>
      <p style={styles.subtitle}>Personal techno curation — hit play and curate.</p>

      {!started && (
        <button style={styles.play} onClick={() => void start()}>
          ▶ Play
        </button>
      )}

      {/* Player stays mounted so the iframe persists across tracks. */}
      <div style={{ display: started ? 'block' : 'none' }}>
        <div ref={player.containerRef} style={styles.player} />

        {status === 'loading' && <p>Loading…</p>}

        {status === 'seeding' && (
          <p style={styles.notice}>
            No rating signal yet and no seeds resolved. Add labels/artists/releases to{' '}
            <code>config/seeds.json</code> (see <code>config/seeds.example.json</code>), then
            <button style={styles.smallBtn} onClick={() => void start()}>Refill</button>.
          </p>
        )}

        {(status === 'empty' || status === 'exhausted') && (
          <p style={styles.notice}>
            {status === 'exhausted' ? 'Explore queue exhausted.' : 'Nothing to play yet.'}{' '}
            <button style={styles.smallBtn} onClick={() => void start()}>Refill queue</button>
          </p>
        )}

        {status === 'error' && <p style={styles.error}>Error: {message}</p>}

        {current && status === 'playing' && (
          <section style={styles.nowPlaying}>
            <h2 style={{ margin: '8px 0' }}>{current.track.title}</h2>
            <div style={styles.meta}>
              {current.artists.map((a) => a.name).join(', ') || 'Unknown artist'}
              {current.labels.length > 0 && <> · {current.labels.map((l) => l.name).join(', ')}</>}
              {current.release.isVa && <> · VA</>}
            </div>
            <div style={styles.reason}>why: {current.reason}</div>

            <div style={styles.controls}>
              <button style={styles.ctrl} onClick={togglePlay}>{paused ? '▶ Play' : '⏸ Pause'}</button>
              <button style={styles.like} onClick={() => void advance('like')}>👍 Like</button>
              <button style={styles.dislike} onClick={() => void advance('dislike')}>👎 Dislike</button>
              <button style={styles.ctrl} onClick={() => void advance('skip')}>⏭ Skip</button>
            </div>
          </section>
        )}

        <DownloadsPanel downloads={downloads} />
      </div>
    </main>
  );
}

function DownloadsPanel({ downloads }: { downloads: DownloadItem[] }) {
  if (downloads.length === 0) return null;
  return (
    <section style={styles.downloads}>
      <h3 style={{ margin: '8px 0' }}>Downloads</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {downloads.slice(0, 8).map((d) => (
          <li key={d.id}>
            <code>{d.trackId}</code> — {d.status}
            {d.error ? ` (${d.error})` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  main: { fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto', padding: '2rem' },
  subtitle: { color: '#666', marginTop: 0 },
  play: { fontSize: 20, padding: '12px 28px', cursor: 'pointer', borderRadius: 8 },
  player: { background: '#000', borderRadius: 8, overflow: 'hidden', minHeight: 200 },
  nowPlaying: { marginTop: 16 },
  meta: { color: '#444' },
  reason: { color: '#888', fontSize: 13, marginTop: 4 },
  controls: { display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  ctrl: { padding: '10px 16px', cursor: 'pointer', borderRadius: 6 },
  like: { padding: '10px 16px', cursor: 'pointer', borderRadius: 6, background: '#1f9d55', color: '#fff', border: 'none' },
  dislike: { padding: '10px 16px', cursor: 'pointer', borderRadius: 6, background: '#cc1f1f', color: '#fff', border: 'none' },
  notice: { background: '#f4f4f4', padding: 12, borderRadius: 6 },
  error: { color: '#cc1f1f' },
  smallBtn: { marginLeft: 8, padding: '4px 10px', cursor: 'pointer' },
  downloads: { marginTop: 24, fontSize: 13, color: '#555' },
};
