import type { CSSProperties } from 'react';
import type { Stats } from '@smartcrate/shared';

const BARS = '▁▂▃▄▅▆▇█';

function sparkline(values: Array<number | null>): string {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return '—';
  const min = Math.min(...nums);
  const span = Math.max(...nums) - min || 1;
  return values
    .map((v) => (v === null ? ' ' : BARS[Math.round(((v - min) / span) * (BARS.length - 1))]))
    .join('');
}

const pct = (v: number | null): string => (v === null ? '—' : `${Math.round(v * 100)}%`);

export function StatsView({ stats }: { stats: Stats | null }) {
  if (!stats) return <p>Loading stats…</p>;

  const c = stats.counters;
  return (
    <div>
      <section style={s.panel}>
        <h3 style={s.h}>Like-rate</h3>
        <div style={s.big}>{pct(stats.likeRate.overall)}</div>
        <div style={s.spark} title="daily like-rate">
          {sparkline(stats.likeRate.daily.map((d) => d.rate))}
        </div>
        <div style={s.sub}>overall · daily trend (last {stats.likeRate.daily.length} active days)</div>
      </section>

      <section style={s.panel}>
        <h3 style={s.h}>By source</h3>
        {stats.bySource.length === 0 ? (
          <div style={s.sub}>No tagged ratings yet.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr><th style={s.th}>source</th><th style={s.th}>like-rate</th><th style={s.th}>share of likes</th><th style={s.th}>rated</th></tr>
            </thead>
            <tbody>
              {stats.bySource.map((b) => (
                <tr key={b.source}>
                  <td style={s.td}>{b.source}</td>
                  <td style={s.td}>{pct(b.likeRate)}</td>
                  <td style={s.td}>{pct(b.likeShare)}</td>
                  <td style={s.td}>{b.rated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={s.caveat}>
          Contribution mix, <strong>not</strong> causal lift — sources aren't randomly assigned
          (siblings come from already-liked releases), so a higher rate doesn't prove the feature
          causes better picks.
        </div>
      </section>

      <section style={s.panel}>
        <h3 style={s.h}>Output</h3>
        <div style={s.sub}>
          today: {c.today.rated} rated · {c.today.liked} liked · {c.today.downloaded} downloaded
        </div>
        <div style={s.sub}>
          total: {c.total.rated} rated · {c.total.liked} liked · {c.total.downloaded} downloaded
          {c.total.downloadFailed > 0 ? ` · ${c.total.downloadFailed} failed` : ''}
        </div>
      </section>

      <section style={s.panel}>
        <h3 style={s.h}>Taste · catalog</h3>
        <div style={s.cols}>
          <Leader title="Top labels" rows={stats.taste.labels} />
          <Leader title="Top artists" rows={stats.taste.artists} />
        </div>
        <div style={s.sub}>unresolved (no YouTube video): {pct(stats.unresolvedRate)} of fetched tracks</div>
      </section>
    </div>
  );
}

function Leader({ title, rows }: { title: string; rows: Array<{ id: number; name: string; score: number }> }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={s.leaderTitle}>{title}</div>
      {rows.length === 0 ? (
        <div style={s.sub}>—</div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          {rows.map((r) => (
            <li key={r.id}>{r.name} <span style={s.sub}>({r.score.toFixed(1)})</span></li>
          ))}
        </ol>
      )}
    </div>
  );
}

const ACCENT = '#9fef00';
const MUTED = '#86868f';
const BORDER = '#26262b';

const s: Record<string, CSSProperties> = {
  panel: { padding: '10px 0', marginBottom: 10, borderBottom: `1px solid ${BORDER}` },
  h: { margin: '0 0 8px', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: MUTED },
  big: { fontSize: 32, fontWeight: 700, color: '#ececee', fontFamily: 'ui-monospace, Menlo, monospace', fontVariantNumeric: 'tabular-nums' },
  spark: { fontSize: 20, letterSpacing: 1, fontFamily: 'ui-monospace, Menlo, monospace', color: ACCENT },
  sub: { color: MUTED, fontSize: 13 },
  caveat: { color: '#b59f5b', fontSize: 12, marginTop: 8, lineHeight: 1.4 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13 },
  th: { textAlign: 'left', color: MUTED, fontWeight: 500, padding: '2px 8px' },
  td: { padding: '2px 8px' },
  cols: { display: 'flex', gap: 24, marginBottom: 8 },
  leaderTitle: { fontWeight: 600, marginBottom: 4, fontSize: 13 },
};
