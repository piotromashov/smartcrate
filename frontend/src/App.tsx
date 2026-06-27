// App shell. The curation player (embedded YouTube, like/dislike/skip,
// auto-advance) is built in the frontend curation-player task group.
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>smartcrate</h1>
      <p>Personal techno curation engine. Hit play to start curating.</p>
    </main>
  );
}
