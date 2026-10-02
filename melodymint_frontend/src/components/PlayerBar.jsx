import { usePlayer } from "../api/PlayerContext";

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PlayerBar() {
  const {
    currentSong,
    isPlaying,
    elapsed,
    volume,
    shuffle,
    loop,
    hasAudio,
    togglePlay,
    goNext,
    goPrev,
    seek,
    setVolume,
    toggleShuffle,
    toggleLoop,
  } = usePlayer();

  if (!currentSong) {
    return (
      <div className="player-bar player-bar-empty">
        <span className="empty">Nothing playing — hit ▶ on a song to start.</span>
      </div>
    );
  }

  const pct = currentSong.duration_sec ? (elapsed / currentSong.duration_sec) * 100 : 0;

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(Math.max(0, Math.min(1, ratio)) * currentSong.duration_sec);
  };

  return (
    <div className="player-bar">
      <div className="player-track-info">
        <div className="player-track-title">
          {currentSong.title}
          {!hasAudio && <span className="badge" style={{ marginLeft: 8 }}>no audio file</span>}
        </div>
        <div className="player-track-artist">{currentSong.artist_name}</div>
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            className={`player-btn ${shuffle ? "active" : ""}`}
            onClick={toggleShuffle}
            title="Shuffle"
          >
            ⇄
          </button>
          <button className="player-btn" onClick={goPrev} title="Previous">
            ⏮
          </button>
          <button className="player-btn player-btn-main" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button className="player-btn" onClick={goNext} title="Next">
            ⏭
          </button>
          <button
            className={`player-btn ${loop ? "active" : ""}`}
            onClick={toggleLoop}
            title="Loop"
          >
            ↻
          </button>
        </div>
        <div className="player-progress-row">
          <span className="player-time">{formatTime(elapsed)}</span>
          <div className="player-progress-track" onClick={handleSeek}>
            <div className="player-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="player-time">{formatTime(currentSong.duration_sec)}</span>
        </div>
      </div>

      <div className="player-volume">
        <span className="player-vol-icon">{volume === 0 ? "🔇" : volume < 50 ? "🔉" : "🔊"}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
