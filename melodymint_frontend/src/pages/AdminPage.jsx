import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";

export default function AdminPage() {
  const { showToast, currentUser } = useApp();
  const [users, setUsers] = useState([]);
  const [flaggedTags, setFlaggedTags] = useState([]);
  const [tagsById, setTagsById] = useState({});
  const [songsById, setSongsById] = useState({});
  const [topArtists, setTopArtists] = useState([]);

  const loadUsers = async () => {
    try {
      const list = await api.adminListUsers();
      setUsers(list);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const loadFlaggedTags = async () => {
    try {
      const [songTags, allTags] = await Promise.all([api.adminListSongTags(), api.listTags()]);
      setTagsById(Object.fromEntries(allTags.map((t) => [t.tag_id, t])));
      const flagged = songTags.filter((st) => st.downvotes > 0 || st.status === "removed");
      setFlaggedTags(flagged);
      const uniqueSongIds = [...new Set(flagged.map((st) => st.song_id))];
      if (uniqueSongIds.length) {
        const songs = await Promise.all(uniqueSongIds.map((id) => api.getSong(id)));
        setSongsById(Object.fromEntries(songs.map((s) => [s.song_id, s])));
      }
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    loadUsers();
    loadFlaggedTags();
    api.adminTopArtists().then(setTopArtists).catch(() => {});
  }, []);

  const handleToggleBan = async (user) => {
    if (user.user_id === currentUser.user_id) {
      showToast("You cannot ban yourself", true);
      return;
    }
    try {
      await api.adminUpdateUser(user.user_id, { is_banned: !user.is_banned });
      showToast(user.is_banned ? "User unbanned" : "User banned");
      loadUsers();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const handleRoleChange = async (user, role) => {
    try {
      await api.adminUpdateUser(user.user_id, { role });
      showToast(`${user.username} is now ${role}`);
      loadUsers();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const handleModerate = async (songTagId, status) => {
    try {
      await api.adminModerateSongTag(songTagId, status);
      showToast(status === "removed" ? "Tag removed" : "Tag reinstated");
      loadFlaggedTags();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-sub">Manage users and moderate community-flagged tags.</p>
      </div>

      <div className="card">
        <div className="card-title">Top artists (by listening time)</div>
        {topArtists.length === 0 && <div className="empty">No listening data yet.</div>}
        {topArtists.map((a) => (
          <div className="row" key={a.user_id}>
            <div className="row-main">
              <div className="row-title">#{a.rank} {a.username}</div>
              <div className="row-sub">{a.song_count} song(s) · {a.total_listened_sec}s listened total</div>
            </div>
            <span className="badge badge-gold">{a.tokens_earned} tokens earned</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Flagged tags</div>
        {flaggedTags.length === 0 && <div className="empty">Nothing flagged right now.</div>}
        {flaggedTags.map((st) => {
          const song = songsById[st.song_id];
          const tag = tagsById[st.tag_id];
          return (
            <div className="row" key={st.song_tag_id}>
              <div className="row-main">
                <div className="row-title">
                  {song ? song.title : `Song #${st.song_id}`} — {tag ? tag.tag_name : `Tag #${st.tag_id}`}
                </div>
                <div className="row-sub">
                  {st.upvotes} up / {st.downvotes} down · status: {st.status}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {st.status !== "removed" ? (
                  <button className="btn btn-small btn-danger" onClick={() => handleModerate(st.song_tag_id, "removed")}>
                    Remove
                  </button>
                ) : (
                  <button className="btn btn-small btn-primary" onClick={() => handleModerate(st.song_tag_id, "active")}>
                    Reinstate
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">Users</div>
        {users.map((u) => (
          <div className="row" key={u.user_id}>
            <div className="row-main">
              <div className="row-title">
                {u.username} {u.is_banned && <span className="badge" style={{ marginLeft: 6 }}>banned</span>}
              </div>
              <div className="row-sub">{u.email}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={u.role} onChange={(e) => handleRoleChange(u, e.target.value)}>
                <option value="listener">listener</option>
                <option value="artist">artist</option>
                <option value="admin">admin</option>
              </select>
              <button className="btn btn-small btn-danger" onClick={() => handleToggleBan(u)}>
                {u.is_banned ? "Unban" : "Ban"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
