import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";

export default function AddToPlaylistButton({ songId }) {
  const { activeUserId, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!activeUserId) return;
    try {
      const pl = await api.listUserPlaylists(activeUserId);
      setPlaylists(pl);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAdd = async (playlistId) => {
    setLoading(true);
    try {
      const existing = await api.getPlaylistSongs(playlistId);
      await api.addSongToPlaylist(playlistId, { song_id: songId, position: existing.length + 1 });
      showToast("Added to playlist");
      setOpen(false);
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-to-playlist">
      <button className="btn btn-small" onClick={() => setOpen((o) => !o)}>
        + Playlist
      </button>
      {open && (
        <div className="add-to-playlist-menu">
          {playlists.length === 0 && <div className="empty" style={{ padding: 10 }}>No playlists yet.</div>}
          {playlists.map((pl) => (
            <button
              key={pl.playlist_id}
              className="add-to-playlist-item"
              disabled={loading}
              onClick={() => handleAdd(pl.playlist_id)}
            >
              {pl.playlist_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
