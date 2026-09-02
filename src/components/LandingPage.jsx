import React from "react";
import { useAuth } from "../AuthContext";

export default function LandingPage() {
  const { login, error } = useAuth();
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await login(password);
    setBusy(false);
  };

  return (
    <div className="landing-page">
      <form className="landing-card" onSubmit={handleSubmit}>
        <div className="landing-icon">🌱</div>
        <h1>Hydroponic Farm</h1>
        <p className="landing-subtitle">Enter password to access dashboard</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="landing-input"
        />
        {error && <div className="landing-error">{error}</div>}
        <button type="submit" disabled={busy} className="landing-button">
          {busy ? "Checking..." : "Login"}
        </button>
      </form>
    </div>
  );
}
