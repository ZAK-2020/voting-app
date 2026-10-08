import { useContext, useEffect, useState } from "react";
import { BrowserRouter, Link, Routes, Route, Navigate, useLocation } from "react-router-dom";
import socketIOClient from "socket.io-client";
import { AuthContext } from "./context/AuthContext";
import { SOCKET_URL } from "./config";
import HomePage from "./components/HomePage";
import CreatePoll from "./components/CreatePoll";
import PollPage from "./components/PollPage";
import AuthPage from "./components/AuthPage";
import JoinPoll from "./components/JoinPoll";
import PresentationPage from "./components/PresentationPage";
import DraftsPage from "./components/DraftsPage";

function Shell() {
  const { user, loading, logout, authError, retryAuth, manageAccount } = useContext(AuthContext);
  const [revision, setRevision] = useState(0);
  const [connected, setConnected] = useState(false);
  const location = useLocation();
  const presenting = /^\/polls\/[^/]+\/present\/?$/.test(location.pathname);
  useEffect(() => {
    const socket = socketIOClient(SOCKET_URL || undefined);
    const refresh = () => setRevision(value => value + 1);
    socket.on("connect", () => { setConnected(true); refresh(); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("pollChanged", refresh);
    // Refresh after missed events, tab switches, and scheduled deadlines.
    const interval = setInterval(refresh, 15000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { socket.disconnect(); clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    if (user && !/^\/(login|register)(\/|$)/.test(location.pathname)) sessionStorage.removeItem("gather.authReturn");
  }, [user, location.pathname]);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    {!presenting && <header className="app-header">
      <Link to="/" className="brand" aria-label="Voting app home"><span className="brand-icon" aria-hidden="true">✓</span><span>Gather<span className="brand-dot">.</span></span></Link>
      <nav aria-label="Main navigation">
        <Link to="/" className={location.pathname === "/" ? "nav-link active" : "nav-link"}>All polls</Link>
        <Link to="/join" className="nav-link">Join poll</Link>
        {user && <Link to="/drafts" className="nav-link">My drafts</Link>}
        {user ? <><button className="text-button" onClick={manageAccount} aria-label="Account settings">{user.username || "Account"}</button><button className="text-button" onClick={logout}>Sign out</button></> :
          <Link className="nav-link" to="/login" state={{ from: location.pathname }}>Sign in</Link>}
        <Link className="button primary small" to="/create">+ Create poll</Link>
      </nav>
    </header>}
    <main id="main" tabIndex={-1} className={presenting ? "presentation-main" : "main-content"}>
      {loading ? <div className="page-message" role="status">Loading your session…</div> : authError ?
        <div className="surface auth-card"><h1>Check your account</h1><p className="error-message" role="alert">{authError}</p><div className="form-actions"><button className="button primary" onClick={retryAuth}>Try again</button><button className="button secondary" onClick={manageAccount}>Account settings</button><button className="text-button" onClick={logout}>Sign out</button></div></div> :
        <Routes>
          <Route path="/" element={<HomePage revision={revision} />} />
          <Route path="/join" element={<JoinPoll />} />
          <Route path="/join/:code" element={<JoinPoll />} />
          <Route path="/polls/:id/present" element={<PresentationPage key={location.pathname} revision={revision} connected={connected} />} />
          <Route path="/create" element={user ? <CreatePoll key={"new-" + user._id} /> : <Navigate to="/login" state={{ from: "/create" }} replace />} />
          <Route path="/drafts" element={user ? <DraftsPage key={user._id} /> : <Navigate to="/login" state={{ from: "/drafts" }} replace />} />
          <Route path="/drafts/:id/edit" element={user ? <CreatePoll key={location.pathname + user._id} /> : <Navigate to="/login" state={{ from: location.pathname }} replace />} />
          <Route path="/polls/:id" element={<PollPage key={location.pathname + (user?._id || "guest")} revision={revision} connected={connected} />} />
          <Route path="/login/*" element={<AuthPage />} />
          <Route path="/register/*" element={<AuthPage register />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="*" element={<div className="page-message"><h1>Page not found</h1><Link to="/">Back to polls</Link></div>} />
        </Routes>}
    </main>
    {!presenting && <footer className="app-footer"><span>Small questions. Shared decisions.</span><span>Made for your community.</span></footer>}
  </>;
}
export default function App() { return <BrowserRouter><Shell /></BrowserRouter>; }
