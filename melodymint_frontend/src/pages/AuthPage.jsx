import { useState } from "react";
import { useApp } from "../api/AppContext";

export default function AuthPage() {
  const { login, register, showToast } = useApp();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("listener");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, email, password, role);
      }
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: 360 }}>
        <div className="brand" style={{ marginBottom: 24, alignItems: "center", textAlign: "center" }}>
          <div className="brand-mark">
            Melody<span>Mint</span>
          </div>
          <div className="brand-sub">Tag &amp; Token Platform</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          {mode === "register" && (
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          {mode === "register" && (
            <div className="field">
              <label>I am a…</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="listener">Listener</option>
                <option value="artist">Artist</option>
              </select>
            </div>
          )}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
          {mode === "login" ? (
            <>
              No account?{" "}
              <button className="btn btn-small" onClick={() => setMode("register")} style={{ display: "inline" }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="btn btn-small" onClick={() => setMode("login")} style={{ display: "inline" }}>
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
