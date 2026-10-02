import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useApp } from "../api/AppContext";

export default function SettingsPage() {
  const { currentUser, showToast } = useApp();
  const [settings, setSettings] = useState(null);

  const loadSettings = async () => {
    try {
      const s = await api.getPlaybackSettings();
      setSettings(s);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = async (patch) => {
    try {
      const s = await api.updatePlaybackSettings(patch);
      setSettings(s);
    } catch (e) {
      showToast(e.message, true);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Playback preferences for {currentUser.username}.</p>
      </div>

      <div className="card">
        <div className="card-title">Account</div>
        <div className="row">
          <div className="row-main">
            <div className="row-title">Username</div>
          </div>
          <div className="row-meta">{currentUser.username}</div>
        </div>
        <div className="row">
          <div className="row-main">
            <div className="row-title">Email</div>
          </div>
          <div className="row-meta">{currentUser.email}</div>
        </div>
        <div className="row">
          <div className="row-main">
            <div className="row-title">Role</div>
          </div>
          <span className="badge badge-mint">{currentUser.role}</span>
        </div>
      </div>

      {/* <div className="card">
        <div className="card-title">Playback</div>
        {settings && (
          <>
            <div className="field">
              <label>Volume — {settings.volume}</label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
              />
            </div>
            <div className="row">
              <div className="row-main">
                <div className="row-title">Shuffle</div>
              </div>
              <button
                className={`btn btn-small ${settings.shuffle ? "btn-primary" : ""}`}
                onClick={() => update({ shuffle: !settings.shuffle })}
              >
                {settings.shuffle ? "On" : "Off"}
              </button>
            </div>
            <div className="row">
              <div className="row-main">
                <div className="row-title">Loop</div>
              </div>
              <button
                className={`btn btn-small ${settings.loop ? "btn-primary" : ""}`}
                onClick={() => update({ loop: !settings.loop })}
              >
                {settings.loop ? "On" : "Off"}
              </button>
            </div>
          </>
        )}
      </div> */}


    </div>
  );
}
