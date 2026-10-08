export const normalizeCode = value => value.replace(/[\s-]/g, "").toUpperCase();
export const validCode = value => /^[A-HJ-NP-Z2-9]{6}$/.test(value);
export function shareOrigin() {
  const configured = process.env.REACT_APP_SHARE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (["http:", "https:"].includes(url.protocol)) return url.origin;
    } catch { /* Invalid configuration falls back to this site. */ }
  }
  return window.location.origin;
}
export const pollShareUrl = poll => shareOrigin() + (poll.joinCode ? "/join/" + poll.joinCode : "/polls/" + poll._id);
