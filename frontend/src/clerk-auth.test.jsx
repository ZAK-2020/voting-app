import React, { act, useContext } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthContext, ClerkSessionProvider } from "./context/AuthContext";
import AuthPage from "./components/AuthPage";
import { api } from "./api";
import { sessionToken } from "./auth-token";
import { SignIn, SignUp, useAuth, useClerk } from "@clerk/react";

jest.mock("@clerk/react", () => ({
  SignIn: jest.fn(() => <div>Clerk sign in</div>), SignUp: jest.fn(() => <div>Clerk sign up</div>),
  useAuth: jest.fn(), useClerk: jest.fn(),
}));
jest.mock("./api", () => ({ api: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, state;
const getToken = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  state = { isLoaded: true, isSignedIn: true, sessionId: "session-a", getToken };
  useAuth.mockImplementation(() => state);
  useClerk.mockReturnValue({ signOut: jest.fn(), openUserProfile: jest.fn() });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
function Status() {
  const auth = useContext(AuthContext);
  return <div>{auth.loading ? "Loading" : auth.user?.username || auth.authError || "Guest"}<button onClick={auth.retryAuth}>Retry</button></div>;
}
async function session() { await act(async () => root.render(<ClerkSessionProvider><Status /></ClerkSessionProvider>)); }
async function page(entry, register = false) {
  await act(async () => root.render(<AuthContext.Provider value={{ user: null, authConfigured: true }}><MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="*" element={<AuthPage register={register} />} /></Routes></MemoryRouter></AuthContext.Provider>));
}

test("sign in and signup preserve a shared poll destination through redirects", async () => {
  const target = "/polls/" + "a".repeat(24);
  await page({ pathname: "/login", state: { from: target } });
  expect(SignIn.mock.calls.at(-1)[0].forceRedirectUrl).toBe(target);
  expect(SignIn.mock.calls.at(-1)[0].signUpUrl).toContain(encodeURIComponent(target));
  expect(sessionStorage.getItem("gather.authReturn")).toBe(target);
  await act(async () => root.unmount()); root = createRoot(container);
  await page("/register/verify-email-address", true);
  expect(SignUp.mock.calls.at(-1)[0].forceRedirectUrl).toBe(target);
});

test("external redirect targets are refused", async () => {
  await page("/login?next=https://evil.example.com");
  expect(SignIn.mock.calls.at(-1)[0].forceRedirectUrl).toBe("/");
});

test("session bridge removes legacy tokens and obtains fresh Clerk tokens", async () => {
  localStorage.setItem("token", "old-password-jwt");
  api.mockResolvedValue({ _id: "new-id", username: "New account" });
  getToken.mockResolvedValueOnce("fresh-one").mockResolvedValueOnce("fresh-two");
  await session();
  expect(container.textContent).toContain("New account");
  expect(localStorage.getItem("token")).toBeNull();
  expect(await sessionToken()).toBe("fresh-one");
  expect(await sessionToken()).toBe("fresh-two");
  state = { ...state, isSignedIn: false, sessionId: null };
  await session();
  expect(container.textContent).toContain("Guest");
  expect(await sessionToken()).toBeNull();
});

test("account verification errors are visible and recover after retry", async () => {
  api.mockRejectedValueOnce(new Error("Verify your primary email before continuing."));
  await session();
  expect(container.textContent).toContain("Verify your primary email");
  api.mockResolvedValueOnce({ username: "Verified account" });
  await act(async () => container.querySelector("button").click());
  expect(container.textContent).toContain("Verified account");
});

test("a late request cannot expose the previous account after switching sessions", async () => {
  let finish;
  api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await session();
  expect(container.textContent).toContain("Loading");
  state = { ...state, sessionId: "session-b" };
  api.mockResolvedValueOnce({ username: "Second account" });
  await session();
  await act(async () => finish({ username: "First account" }));
  expect(container.textContent).toContain("Second account");
  expect(container.textContent).not.toContain("First account");
});
