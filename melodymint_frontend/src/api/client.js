const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const API_BASE_URL = BASE_URL;

function getToken() {
  return localStorage.getItem("melodymint_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // auth
  register: (data) => request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: async (username, password) => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  },
  me: () => request("/auth/me"),

  // users
  listUsers: () => request("/users/"),
  getUser: (id) => request(`/users/${id}`),
  getWallet: (id) => request(`/users/${id}/wallet`),

  // transactions
  createTransaction: (data) => request("/transactions/", { method: "POST", body: JSON.stringify(data) }),

  // songs
  listSongs: () => request("/songs/"),
  searchSongs: (q) => request(`/songs/search?q=${encodeURIComponent(q)}`),
  createSong: (data) => request("/songs/", { method: "POST", body: JSON.stringify(data) }),
  getSong: (id) => request(`/songs/${id}`),
  uploadSong: async (title, artistName, file) => {
    const form = new FormData();
    form.append("title", title);
    form.append("artist_name", artistName);
    form.append("file", file);
    const token = getToken();
    const res = await fetch(`${BASE_URL}/songs/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (_) {}
      throw new Error(detail);
    }
    return res.json();
  },

  // tags
  listTags: () => request("/tags/"),
  createTag: (data) => request("/tags/", { method: "POST", body: JSON.stringify(data) }),
  suggestSongTag: (data) => request("/song-tags/", { method: "POST", body: JSON.stringify(data) }),
  getSongTags: (songId) => request(`/songs/${songId}/tags`),
  searchSongsByTag: (tagId) => request(`/tags/${tagId}/songs`),
  voteSongTag: (data) => request("/song-tags/vote", { method: "POST", body: JSON.stringify(data) }),
  getRecommendations: () => request("/recommendations/me"),
  getTrendingTags: () => request("/tags/trending"),

  // playlists
  listUserPlaylists: (userId) => request(`/playlists/user/${userId}`),
  createPlaylist: (data) => request("/playlists/", { method: "POST", body: JSON.stringify(data) }),
  getPlaylistSongs: (playlistId) => request(`/playlists/${playlistId}/songs`),
  addSongToPlaylist: (playlistId, data) =>
    request(`/playlists/${playlistId}/songs`, { method: "POST", body: JSON.stringify(data) }),
  removeSongFromPlaylist: (playlistId, songId) =>
    request(`/playlists/${playlistId}/songs/${songId}`, { method: "DELETE" }),

  // listening
  logListening: (data) => request("/listening/", { method: "POST", body: JSON.stringify(data) }),

  // playback settings (always "me" — scoped to the logged-in user)
  getPlaybackSettings: () => request(`/playback-settings/me`),
  updatePlaybackSettings: (data) =>
    request(`/playback-settings/me`, { method: "PATCH", body: JSON.stringify(data) }),

  // admin
  adminListUsers: () => request("/admin/users"),
  adminTopArtists: () => request("/admin/analytics/top-artists"),
  adminUpdateUser: (userId, data) =>
    request(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminListSongTags: (status) =>
    request(`/admin/song-tags${status ? `?status=${status}` : ""}`),
  adminModerateSongTag: (songTagId, status) =>
    request(`/admin/song-tags/${songTagId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  adminDeleteSong: (songId) => request(`/admin/songs/${songId}`, { method: "DELETE" }),
};
