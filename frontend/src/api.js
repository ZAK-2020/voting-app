import { buildApiUrl } from "./config";
import { sessionToken } from "./auth-token";
async function request(path, options) {
  try { return await fetch(buildApiUrl(path), options); }
  catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not connect. Check your connection and try again.");
  }
}
async function readJson(response) {
  const data = await response.json().catch(() => null);
  if (!data) throw new Error("The service is temporarily unavailable. Please try again.");
  if (!response.ok) throw Object.assign(new Error(data.error || "Something went wrong. Please try again."), { status: response.status, code: data.code });
  return data;
}
export async function api(path, { body, ...options } = {}) {
  const token = await sessionToken();
  const response = await request(path, {
    ...options,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return readJson(response);
}
export const isClosed = (poll, now = Date.now()) => Boolean(poll.closedAt || (poll.closesAt && new Date(poll.closesAt).getTime() <= now));
export const formatDate = value => new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export async function downloadResults(pollId) {
  const token = await sessionToken();
  const response = await request("/api/polls/" + pollId + "/export", { headers: token ? { Authorization: "Bearer " + token } : {} });
  if (!response.ok) {
    await readJson(response);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = "gather-" + pollId + ".csv";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
