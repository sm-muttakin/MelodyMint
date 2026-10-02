import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";
import { usePlayer } from "../api/PlayerContext";
import TagChip from "../components/TagChip";
import AddToPlaylistButton from "../components/AddToPlaylistButton";

export default function SongsPage() {
  const { currentUser, showToast } = useApp();
  const { playQueue } = usePlayer();
  const [songs, setSongs] = useState([]);
  const [tags, setTags] = useState([]);
  const [users, setUsers] = useState([]);
  const [songTagsBySong, setSongTagsBySong] = useState({});
  const [expandedSongId, setExpandedSongId] = useState(null);

  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [tagPick, setTagPick] = useState({});

  const load = async () => {
    try {
      const [songList, tagList, userList] = await Promise.all([api.listSongs(), api.listTags(), api.listUsers()]);
      setSongs(songList);
      setTags(tagList);
      setUsers(userList);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadSongTags = async (songId) => {
    try {
      const st = await api.getSongTags(songId);
      setSongTagsBySong((prev) => ({ ...prev, [songId]: st }));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const toggleExpand = (songId) => {
    const next = expandedSongId === songId ? null : songId;
    setExpandedSongId(next);
    if (next && !songTagsBySong[songId]) loadSongTags(songId);
  };

  const handleUpload = async () => {
    if (!title.trim() || !artistName.trim()) {
      showToast("Title and artist name are required", true);
      return;
    }
    if (!audioFile) {
      showToast("Choose an audio file to upload", true);
      return;
    }
    setUploading(true);
    try {
      await api.uploadSong(title.trim(), artistName.trim(), audioFile);
      showToast(`Uploaded "${title}"`);
      setTitle("");
      setArtistName("");
      setAudioFile(null);
      load();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setUploading(false);
    }
  };

  const handleSuggestTag = async (songId) => {
    const tagId = tagPick[songId];
    if (!tagId) return;
    try {
      await api.suggestSongTag({ song_id: songId, tag_id: Number(tagId) });
      showToast("Tag suggested");
      loadSongTags(songId);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const handlePlay = (songId) => {
    const idx = songs.findIndex((s) => s.song_id === songId);
    if (idx === -1) return;
    playQueue(songs, idx);
  };

  const handleVoted = (songId, updated) => {
    setSongTagsBySong((prev) => ({
      ...prev,
      [songId]: prev[songId].map((st) => (st.song_tag_id === updated.song_tag_id ? updated : st)),
    }));
  };

  const usersById = Object.fromEntries(users.map((u) => [u.user_id, u]));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Songs</h1>
        <p className="page-sub">Upload tracks, tag them, and simulate listens.</p>
      </div>

      {(currentUser.role === "artist" || currentUser.role === "admin") ? (
        <div className="card">
          <div className="card-title">Upload a song</div>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rainy Days" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Artist credit</label>
              <input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Display artist name" />
            </div>
            <div className="field">
              <label>Audio file (mp3, wav, ogg, m4a, flac)</label>
              <input
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,.flac,audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Upload a song</div>
          <div className="empty">Only artist accounts can upload songs. Your account is a listener.</div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Library</div>
        {songs.length === 0 && <div className="empty">No songs yet — upload one above.</div>}
        {songs.map((song) => {
          const owner = usersById[song.owner_id];
          const isOpen = expandedSongId === song.song_id;
          const songTags = songTagsBySong[song.song_id] || [];
          return (
            <div key={song.song_id} style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="row" style={{ borderBottom: "none" }}>
                <div className="row-main">
                  <div className="row-title">
                    {song.title}
                    {!song.audio_url && <span className="badge" style={{ marginLeft: 8 }}>no audio file</span>}
                  </div>
                  <div className="row-sub">
                    {song.artist_name} · uploaded by {owner ? owner.username : `user #${song.owner_id}`} · {song.duration_sec}s
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-small btn-primary" onClick={() => handlePlay(song.song_id)}>
                    ▶ Play
                  </button>
                  <AddToPlaylistButton songId={song.song_id} />
                  <button className="btn btn-small" onClick={() => toggleExpand(song.song_id)}>
                    {isOpen ? "Hide tags" : "Tags"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: "0 0 16px 0" }}>
                  <div style={{ marginBottom: 10 }}>
                    {songTags.length === 0 && <span className="empty">No tags suggested yet.</span>}
                    {songTags.map((st) => {
                      const tag = tags.find((t) => t.tag_id === st.tag_id);
                      if (!tag) return null;
                      return (
                        <TagChip
                          key={st.song_tag_id}
                          songTag={st}
                          tagName={tag.tag_name}
                          tagCategory={tag.tag_category}
                          onVoted={(updated) => handleVoted(song.song_id, updated)}
                        />
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={tagPick[song.song_id] || ""}
                      onChange={(e) => setTagPick((prev) => ({ ...prev, [song.song_id]: e.target.value }))}
                    >
                      <option value="">Suggest a tag…</option>
                      {tags.map((t) => (
                        <option key={t.tag_id} value={t.tag_id}>
                          {t.tag_name} · {t.tag_category}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-small btn-primary" onClick={() => handleSuggestTag(song.song_id)}>
                      Suggest
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
