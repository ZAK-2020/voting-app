import { createContext, useEffect, useLayoutEffect, useState } from "react";
import { ClerkProvider, useAuth, useClerk } from "@clerk/react";
import { api } from "../api";
import { setTokenGetter } from "../auth-token";

export const AuthContext = createContext();

export function ClerkSessionProvider({ children }) {
  const { isLoaded, isSignedIn, sessionId, getToken } = useAuth();
  const { signOut, openUserProfile } = useClerk();
  const [account, setAccount] = useState({ sessionId: null, user: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const [logoutError, setLogoutError] = useState("");
  useLayoutEffect(() => setTokenGetter(async () => isLoaded && isSignedIn ? getToken() : null), [getToken, isLoaded, isSignedIn, sessionId]);
  useEffect(() => {
    // Retire tokens left by the former password-based login.
    localStorage.removeItem("token");
  }, []);
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    api("/api/me").then(user => {
      if (active) setAccount({ sessionId, user, error: "" });
    }).catch(error => {
      if (active) setAccount({ sessionId, user: null, error: error.message });
    });
    return () => { active = false; };
  }, [isLoaded, isSignedIn, sessionId, attempt]);
  const current = isSignedIn && account.sessionId === sessionId;
  const retryAuth = () => { setAccount({ sessionId: null, user: null, error: "" }); setLogoutError(""); setAttempt(value => value + 1); };
  async function logout() {
    try { await signOut(); setAccount({ sessionId: null, user: null, error: "" }); setLogoutError(""); }
    catch { setLogoutError("Could not sign out. Please try again."); }
  }
  return <AuthContext.Provider value={{
    user: current ? account.user : null,
    loading: !isLoaded || (isSignedIn && !current),
    authError: logoutError || (current ? account.error : ""),
    authConfigured: true,
    retryAuth, logout, manageAccount: () => openUserProfile(),
  }}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  const key = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
  if (!key) return <AuthContext.Provider value={{ user: null, loading: false, authConfigured: false }}>{children}</AuthContext.Provider>;
  return <ClerkProvider publishableKey={key} signInUrl="/login" signUpUrl="/register" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" appearance={{ variables: {
    colorPrimary: "#6366F1", colorText: "#0F172A", colorTextSecondary: "#64748B", colorBackground: "#FFFFFF", borderRadius: "12px", fontFamily: "inherit",
  } }}><ClerkSessionProvider>{children}</ClerkSessionProvider></ClerkProvider>;
}
