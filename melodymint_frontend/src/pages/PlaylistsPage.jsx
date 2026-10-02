import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";
import { usePlayer } from "../api/PlayerContext";

export default function PlaylistsPage() {
  const { activeUserId, showToast } = useApp();
  const { playQueue } = usePlayer();
  const [playlists, setPlaylists] = useState([]);
  const [songs, setSongs] = useState([]);
  const [name, setName] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [playlistSongs, setPlaylistSongs] = useState({});
  const [songPick, setSongPick] = useState({});

  const load = async () => {
    if (!activeUserId) return;
    try {
      const [pl, allSongs] = await Promise.all([api.listUserPlaylists(activeUserId), api.listSongs()]);
      setPlaylists(pl);
      setSongs(allSongs);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  const loadPlaylistSongs = async (playlistId) => {
    try {
      const s = await api.getPlaylistSongs(playlistId);
      setPlaylistSongs((prev) => ({ ...prev, [playlistId]: s }));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const toggleExpand = (id) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next) loadPlaylistSongs(id);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await api.createPlaylist({ playlist_name: name.trim() });
      showToast(`Created playlist "${name}"`);
      setName("");
      load();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const handleAddSong = async (playlistId) => {
    const songId = songPick[playlistId];
    if (!songId) return;
    const currentSongs = playlistSongs[playlistId] || [];
    try {
      await api.addSongToPlaylist(playlistId, { song_id: Number(songId), position: currentSongs.length + 1 });
      showToast("Song added");
      loadPlaylistSongs(playlistId);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const handleRemoveSong = async (playlistId, songId) => {
    try {
      await api.removeSongFromPlaylist(playlistId, songId);
      showToast("Song removed");
      loadPlaylistSongs(playlistId);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const playPlaylist = (playlistId) => {
    const plSongs = playlistSongs[playlistId] || [];
    if (plSongs.length === 0) {
      showToast("This playlist is empty", true);
      return;
    }
    playQueue(plSongs, 0);
  };

  const playFromPlaylist = (playlistId, songId) => {
    const plSongs = playlistSongs[playlistId] || [];
    const idx = plSongs.findIndex((s) => s.song_id === songId);
    if (idx === -1) return;
    playQueue(plSongs, idx);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Playlists</h1>
        <p className="page-sub">Your private collections.</p>
      </div>

      <div className="card">
        <div className="card-title">New playlist</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", color: "var(--text)" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chill Mix"
          />
          <button className="btn btn-primary" onClick={handleCreate}>
            Create
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Your playlists</div>
        {playlists.length === 0 && <div className="empty">No playlists yet.</div>}
        {playlists.map((pl) => {
          const isOpen = expandedId === pl.playlist_id;
          const plSongs = playlistSongs[pl.playlist_id] || [];
          const plSongIds = new Set(plSongs.map((s) => s.song_id));
          const availableSongs = songs.filter((s) => !plSongIds.has(s.song_id));
          return (
            <div key={pl.playlist_id} style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="row" style={{ borderBottom: "none" }}>
                <div className="row-main">
                  <div className="row-title">{pl.playlist_name}</div>
                  <div className="row-sub">{pl.visibility}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-small btn-primary" onClick={() => playPlaylist(pl.playlist_id)}>
                    ▶ Play all
                  </button>
                  <button className="btn btn-small" onClick={() => toggleExpand(pl.playlist_id)}>
                    {isOpen ? "Hide" : "Open"}
                  </button>
                </div>
              </div>
              {isOpen && (
                <div style={{ paddingBottom: 16 }}>
                  {plSongs.length === 0 && <div className="empty">No songs in this playlist yet.</div>}
                  {plSongs.map((s) => (
                    <div className="row" key={s.song_id}>
                      <div className="row-main">
                        <div className="row-title">{s.title}</div>
                        <div className="row-sub">{s.artist_name}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-small" onClick={() => playFromPlaylist(pl.playlist_id, s.song_id)}>
                          ▶
                        </button>
                        <button className="btn btn-small btn-danger" onClick={() => handleRemoveSong(pl.playlist_id, s.song_id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <select
                      value={songPick[pl.playlist_id] || ""}
                      onChange={(e) => setSongPick((prev) => ({ ...prev, [pl.playlist_id]: e.target.value }))}
                    >
                      <option value="">Add a song…</option>
                      {availableSongs.map((s) => (
                        <option key={s.song_id} value={s.song_id}>
                          {s.title} — {s.artist_name}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-small btn-primary" onClick={() => handleAddSong(pl.playlist_id)}>
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
