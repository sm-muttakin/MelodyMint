import { useState } from "react";
import { AppProvider, useApp } from "./api/AppContext";
import { PlayerProvider } from "./api/PlayerContext";
import Sidebar from "./components/Sidebar";
import PlayerBar from "./components/PlayerBar";
import AuthPage from "./pages/AuthPage";
import DiscoverPage from "./pages/DiscoverPage";
import SongsPage from "./pages/SongsPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import WalletPage from "./pages/WalletPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";

const PAGES = {
  discover: DiscoverPage,
  songs: SongsPage,
  playlists: PlaylistsPage,
  wallet: WalletPage,
  settings: SettingsPage,
  admin: AdminPage,
};

function AuthedApp() {
  const [page, setPage] = useState("discover");
  const Page = PAGES[page];

  return (
    <PlayerProvider>
      <div className="app-shell">
        <Sidebar page={page} setPage={setPage} />
        <main className="main">
          <Page />
        </main>
        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}

function AppInner() {
  const { currentUser, authLoading } = useApp();

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="empty">Loading…</span>
      </div>
    );
  }

  return currentUser ? <AuthedApp /> : <AuthPage />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
