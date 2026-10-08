import { downloadResults } from "./api";
import { setTokenGetter } from "./auth-token";

const originalFetch = global.fetch;
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn();
  URL.createObjectURL = jest.fn(() => "blob:csv-download");
  URL.revokeObjectURL = jest.fn();
  setTokenGetter(async () => "test-session");
});
afterEach(() => {
  jest.runOnlyPendingTimers(); jest.useRealTimers(); jest.restoreAllMocks();
  global.fetch = originalFetch; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  localStorage.clear();
  setTokenGetter(async () => null);
});
test("CSV download sends authentication, uses a safe filename, and releases the blob", async () => {
  const blob = new Blob(["Question,Option,Votes\r\n"], { type: "text/csv" });
  global.fetch.mockResolvedValue({ ok: true, blob: async () => blob });
  let filename;
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () { filename = this.download; });
  await downloadResults("abc123");
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/polls/abc123/export"), { headers: { Authorization: "Bearer test-session" } });
  expect(filename).toBe("gather-abc123.csv");
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(document.querySelector('a[download]')).toBeNull();
  jest.runOnlyPendingTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv-download");
});
test("hidden results cannot create a CSV download", async () => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Results are hidden." }) });
  await expect(downloadResults("abc123")).rejects.toThrow("Results are hidden.");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
