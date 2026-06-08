export default function GamePage() {
  return (
    <div className="game-page">
      <iframe
        src="/game/shell.html"
        className="game-frame"
        title="Joymed — 7 Layers of Ascent"
        allow="autoplay"
      />
    </div>
  );
}
