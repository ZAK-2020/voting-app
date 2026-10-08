let getSessionToken = async () => null;

// Obtain a fresh Clerk token for every request; never persist session JWTs.
export function setTokenGetter(getter) {
  getSessionToken = getter;
  return () => { if (getSessionToken === getter) getSessionToken = async () => null; };
}
export const sessionToken = () => getSessionToken();
