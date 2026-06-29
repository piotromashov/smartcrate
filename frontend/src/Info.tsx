import type { CSSProperties } from 'react';
import type { TrackContext, EntityProfile } from '@smartcrate/shared';

const C = { panel: '#17171b', border: '#2a2a30', text: '#ececee', muted: '#86868f', accent: '#9fef00' };
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

export function TrackInfoPanel({ ctx, loading }: { ctx: TrackContext | null; loading: boolean }) {
  if (loading) return <section style={s.card}><p style={s.muted}>Loading info…</p></section>;
  if (!ctx) return null;
  return (
    <section style={s.card}>
      <h3 style={s.h3}>Tracklist · {ctx.release.title}</h3>
      <ol style={s.list}>
        {ctx.release.tracks.map((t, i) => (
          <li key={i} style={t.isCurrent ? s.trackCurrent : s.track}>
            <span style={s.pos}>{t.position}</span> {t.title}
          </li>
        ))}
      </ol>
      {ctx.artists.map((a) => <Bio key={`a${a.id}`} label="artist" e={a} />)}
      {ctx.labels.map((l) => <Bio key={`l${l.id}`} label="label" e={l} />)}
    </section>
  );
}

function Bio({ label, e }: { label: string; e: EntityProfile }) {
  return (
    <div style={s.bioBlock}>
      <div style={s.bioHead}>
        <span style={s.bioName}>{e.name}</span> <span style={s.muted}>· {label}</span>
      </div>
      {e.bio && <p style={s.bio}>{e.bio}</p>}
      {e.urls.length > 0 && (
        <div style={s.links}>
          {e.urls.slice(0, 5).map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" style={s.link}>{hostname(u)}</a>
          ))}
        </div>
      )}
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const s: Record<string, CSSProperties> = {
  card: { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 6px 20px rgba(0,0,0,.45)' },
  h3: { margin: '0 0 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted },
  list: { margin: '0 0 14px', padding: 0, listStyle: 'none' },
  track: { display: 'flex', gap: 10, padding: '4px 0', fontSize: 13, fontFamily: MONO, color: C.text },
  trackCurrent: { display: 'flex', gap: 10, padding: '4px 0', fontSize: 13, fontFamily: MONO, color: C.accent, fontWeight: 700 },
  pos: { color: C.muted, minWidth: 28 },
  bioBlock: { borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10 },
  bioHead: { fontSize: 14 },
  bioName: { fontWeight: 700 },
  bio: { color: C.text, fontSize: 13, lineHeight: 1.5, margin: '6px 0', whiteSpace: 'pre-wrap' },
  links: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  link: { color: C.accent, fontSize: 12, textDecoration: 'none' },
  muted: { color: C.muted, fontSize: 13 },
};
