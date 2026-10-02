import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";
import { usePlayer } from "../api/PlayerContext";
import TagChip from "../components/TagChip";
import AddToPlaylistButton from "../components/AddToPlaylistButton";

export default function DiscoverPage() {
  const { showToast } = useApp();
  const { playQueue } = usePlayer();

  const [tags, setTags] = useState([]);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [results, setResults] = useState([]);
  const [songsById, setSongsById] = useState({});
  const [tagsById, setTagsById] = useState({});
  const [loading, setLoading] = useState(false);

  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("mood");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [trending, setTrending] = useState([]);

  const loadTags = async () => {
    try {
      const list = await api.listTags();
      setTags(list);
      setTagsById(Object.fromEntries(list.map((t) => [t.tag_id, t])));
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const loadRecommendations = async () => {
    try {
      const recs = await api.getRecommendations();
      setRecommendations(recs);
      const uniqueSongIds = [...new Set(recs.map((st) => st.song_id))];
      if (uniqueSongIds.length) {
        const songs = await Promise.all(uniqueSongIds.map((id) => api.getSong(id)));
        setSongsById((prev) => ({ ...prev, ...Object.fromEntries(songs.map((s) => [s.song_id, s])) }));
      }
    } catch (_) {
      // recommendations are best-effort — no listening history yet is a normal case
    }
  };

  useEffect(() => {
    loadTags();
    loadRecommendations();
    api.getTrendingTags().then(setTrending).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (tagId) => {
    if (!tagId) return;
    setLoading(true);
    try {
      const songTags = await api.searchSongsByTag(tagId);
      setResults(songTags);
      const uniqueSongIds = [...new Set(songTags.map((st) => st.song_id))];
      const songs = await Promise.all(uniqueSongIds.map((id) => api.getSong(id)));
      setSongsById((prev) => ({ ...prev, ...Object.fromEntries(songs.map((s) => [s.song_id, s])) }));
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleTagSelect = (id) => {
    setSelectedTagId(id);
    runSearch(id);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await api.createTag({ tag_name: newTagName.trim(), tag_category: newTagCategory });
      showToast(`Created tag "${newTagName}"`);
      setNewTagName("");
      loadTags();
    } catch (e) {
      showToast(e.message, true);
    }
  };

  const handleVoted = (updated) => {
    setResults((prev) => prev.map((st) => (st.song_tag_id === updated.song_tag_id ? updated : st)));
    setRecommendations((prev) => prev.map((st) => (st.song_tag_id === updated.song_tag_id ? updated : st)));
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const songs = await api.searchSongs(searchQuery.trim());
      setSearchResults(songs);
    } catch (e) {
      showToast(e.message, true);
    } finally {
      setSearching(false);
    }
  };

  const playSong = (song) => playQueue([song], 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Discover</h1>
        <p className="page-sub">Search by title/artist, browse by mood tag, or check your recommendations.</p>
      </div>

      <div className="card">
        <div className="card-title">Search songs</div>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", color: "var(--text)" }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Song title or artist name…"
          />
          <button className="btn btn-primary" type="submit" disabled={searching}>
            Search
          </button>
        </form>
        {searchResults !== null && (
          <div style={{ marginTop: 14 }}>
            {searchResults.length === 0 && <div className="empty">No matches.</div>}
            {searchResults.map((song) => (
              <div className="row" key={song.song_id}>
                <div className="row-main">
                  <div className="row-title">{song.title}</div>
                  <div className="row-sub">{song.artist_name}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-small btn-primary" onClick={() => playSong(song)}>
                    ▶
                  </button>
                  <AddToPlaylistButton songId={song.song_id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <div className="card">
          <div className="card-title">Recommended for you</div>
          {recommendations.map((st) => {
            const song = songsById[st.song_id];
            const tag = tagsById[st.tag_id];
            if (!song) return null;
            return (
              <div className="row" key={st.song_tag_id}>
                <div className="row-main">
                  <div className="row-title">{song.title}</div>
                  <div className="row-sub">
                    {song.artist_name}
                    {tag && ` · because you like ${tag.tag_name}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-small btn-primary" onClick={() => playSong(song)}>
                    ▶
                  </button>
                  <AddToPlaylistButton songId={song.song_id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {trending.length > 0 && (
        <div className="card">
          <div className="card-title">Trending tags right now</div>
          {trending.map((t) => (
            <div className="row" key={t.tag_id}>
              <div className="row-main">
                <div className="row-title">
                  #{t.rank} {t.tag_name} <span className="badge" style={{ marginLeft: 6 }}>{t.tag_category}</span>
                </div>
                <div className="row-sub">{t.song_count} song(s) · {t.total_upvotes} total upvotes</div>
              </div>
              <button className="btn btn-small" onClick={() => handleTagSelect(String(t.tag_id))}>
                Browse
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">Browse by mood / tag</div>
        <div className="field">
          <select value={selectedTagId} onChange={(e) => handleTagSelect(e.target.value)}>
            <option value="">Choose a tag…</option>
            {tags.map((t) => (
              <option key={t.tag_id} value={t.tag_id}>
                {t.tag_name} · {t.tag_category}
              </option>
            ))}
          </select>
        </div>

        {loading && <div className="empty">Searching…</div>}
        {!loading && selectedTagId && results.length === 0 && (
          <div className="empty">No active songs tagged with this yet.</div>
        )}

        {!loading &&
          results.map((st) => {
            const song = songsById[st.song_id];
            const tag = tagsById[st.tag_id];
            if (!song || !tag) return null;
            return (
              <div className="row" key={st.song_tag_id}>
                <div className="row-main">
                  <div className="row-title">{song.title}</div>
                  <div className="row-sub">{song.artist_name}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn btn-small btn-primary" onClick={() => playSong(song)}>
                    ▶
                  </button>
                  <AddToPlaylistButton songId={song.song_id} />
                  <TagChip songTag={st} tagName={tag.tag_name} tagCategory={tag.tag_category} onVoted={handleVoted} />
                </div>
              </div>
            );
          })}
      </div>

      <div className="card">
        <div className="card-title">Create a new tag</div>
        <div className="field-row">
          <div className="field">
            <label>Tag name</label>
            <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="e.g. rainy, lofi, travel" />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={newTagCategory} onChange={(e) => setNewTagCategory(e.target.value)}>
              <option value="genre">Genre</option>
              <option value="mood">Mood</option>
              <option value="context">Context</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleCreateTag}>
          Create tag
        </button>
      </div>
    </div>
  );
}
