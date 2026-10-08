import { api, downloadResults } from "./api";
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("network interruptions give readable guidance without retrying writes", async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  await expect(api("/api/polls/a/votes", { method: "POST", body: { optionId: "b" } })).rejects.toThrow("Check your connection");
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("an HTML proxy error gives service guidance instead of a JSON syntax error", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => { throw new SyntaxError("Unexpected token <"); } });
  await expect(api("/api/polls")).rejects.toThrow("temporarily unavailable");
  await expect(downloadResults("a")).rejects.toThrow("temporarily unavailable");
});
test("specific server messages are preserved", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "This poll is closed." }) });
  await expect(api("/api/polls/a/votes", { method: "POST" })).rejects.toThrow("This poll is closed.");
});
