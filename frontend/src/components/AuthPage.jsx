import { useContext, useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { AuthContext } from "../context/AuthContext";

export function authDestination(target) {
  return typeof target === "string" && (target === "/create" || target === "/drafts" || /^\/drafts\/[a-f0-9]{24}\/edit$/.test(target) || /^\/polls\/[a-f0-9]{24}$/.test(target)) ? target : "/";
}

export default function AuthPage({ register = false }) {
  const { user, authConfigured } = useContext(AuthContext);
  const location = useLocation();
  const [destination] = useState(() => authDestination(location.state?.from || new URLSearchParams(location.search).get("next") || sessionStorage.getItem("gather.authReturn")));
  useEffect(() => { sessionStorage.setItem("gather.authReturn", destination); }, [destination]);
  if (user) return <Navigate to={destination} replace />;
  const suffix = "?next=" + encodeURIComponent(destination);
  return <div className="auth-page">
    <Link className="back-link" to="/">Back to all polls</Link>
    <div className="page-heading compact"><span className="eyebrow">Your voice matters</span><h1>{register ? "Join the conversation." : "Welcome back."}</h1>
      <p>{destination.startsWith("/polls/") ? "Sign in and return to your poll." : "Use your verified account to create polls and vote."}</p>
    </div>
    {!authConfigured ? <div className="surface auth-card"><p role="status">Sign-in is being set up. You can still browse public polls. Please try again later.</p></div> :
      register ? <SignUp routing="path" path="/register" signInUrl={"/login" + suffix} forceRedirectUrl={destination} signInForceRedirectUrl={destination} /> :
        <SignIn routing="path" path="/login" signUpUrl={"/register" + suffix} forceRedirectUrl={destination} signUpForceRedirectUrl={destination} />}
  </div>;
}
