import { buildApiUrl } from "./config";
export async function api(path, { body, ...options } = {}) {
  const token = localStorage.getItem("token");
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export const isClosed = (poll, now = Date.now()) => Boolean(poll.closedAt || (poll.closesAt && new Date(poll.closesAt).getTime() <= now));
export const formatDate = value => new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export async function downloadResults(pollId) {
  const token = localStorage.getItem("token");
  const response = await fetch(buildApiUrl("/api/polls/" + pollId + "/export"), { headers: token ? { Authorization: "Bearer " + token } : {} });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Unable to export results. Please try again.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = "gather-" + pollId + ".csv";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
