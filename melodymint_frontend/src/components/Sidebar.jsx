import { useApp } from "../api/AppContext";

const NAV_ITEMS = [
  { id: "discover", label: "Discover", icon: "◐" },
  { id: "songs", label: "Songs", icon: "♫" },
  { id: "playlists", label: "Playlists", icon: "☰" },
  { id: "wallet", label: "Wallet", icon: "◈" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ page, setPage }) {
  const { currentUser, isAdmin, logout } = useApp();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          Melody<span>Mint</span>
        </div>
        <div className="brand-sub">Tag &amp; Token Platform</div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
        {isAdmin && (
          <button
            className={`nav-item ${page === "admin" ? "active" : ""}`}
            onClick={() => setPage("admin")}
          >
            <span className="nav-icon">🛡</span>
            Admin
          </button>
        )}
      </nav>

      <div className="sidebar-footer">
        <div style={{ marginBottom: 10, color: "var(--text)" }}>
          {currentUser?.username} <span className="badge" style={{ marginLeft: 6 }}>{currentUser?.role}</span>
        </div>
        <button className="btn btn-small btn-block" onClick={logout}>
          Log out
        </button>
      </div>
    </aside>
  );
}
