import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation, useParams } from "react-router-dom";
import { api } from "./api";
import CreatePoll from "./components/CreatePoll";
import DraftsPage from "./components/DraftsPage";
jest.mock("./api", () => ({ ...jest.requireActual("./api"), api: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;
const draft = { _id: "draft123", question: "Where should we meet?", options: ["Park", "Cafe"], resultsVisibility: "after_close", closesAt: null, version: 2, state: "draft", updatedAt: "2026-01-01T00:00:00Z" };
let root, container;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); api.mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
function Editor() { return <CreatePoll key={useParams().id || "new"} />; }
function Destination() { const location = useLocation(); return <p>Published: {location.pathname}</p>; }
async function render(entry) { await act(async () => root.render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/create" element={<Editor />} /><Route path="/drafts/:id/edit" element={<Editor />} /><Route path="/drafts" element={<DraftsPage />} /><Route path="/polls/:id" element={<Destination />} /></Routes></MemoryRouter>)); }
const button = text => [...container.querySelectorAll("button")].find(node => node.textContent.includes(text));
async function click(text) { await act(async () => button(text).click()); }
async function type(selector, value) { await act(async () => { const field = container.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); }); }

test("unfinished draft saves, routes to its editor, and restores its contents", async () => {
  api.mockImplementation((path, options) => Promise.resolve(options?.method === "POST" ? { ...draft, question: "Half an idea", options: ["", ""] } : { ...draft, question: "Half an idea", options: ["", ""] }));
  await render("/create"); await type("#question", "Half an idea"); await click("Save draft");
  expect(api).toHaveBeenCalledWith("/api/drafts", expect.objectContaining({ method: "POST", body: expect.objectContaining({ question: "Half an idea", options: ["", ""] }) }));
  expect(api).toHaveBeenCalledWith("/api/drafts/draft123");
  expect(container.querySelector("#question").value).toBe("Half an idea");
  expect(container.textContent).toContain("Edit your draft.");
});
test("preview saves edits without publishing, preserves the rules, then publishes once", async () => {
  api.mockImplementation((path, options) => Promise.resolve(path.endsWith("/publish") ? { pollId: "live123" } : options?.method === "PUT" ? { ...draft, ...options.body, version: 3 } : draft));
  await render("/drafts/draft123/edit"); await type("#question", "A revised question"); await click("Preview poll");
  expect(api).toHaveBeenCalledWith("/api/drafts/draft123", expect.objectContaining({ method: "PUT", body: expect.objectContaining({ question: "A revised question", version: 2 }) }));
  expect(container.textContent).toContain("Private preview");
  expect(container.textContent).toContain("Results are hidden");
  expect(button("Submit vote").disabled).toBe(true);
  expect(api.mock.calls.some(([path]) => path.endsWith("/publish") || path.endsWith("/votes"))).toBe(false);
  await click("Publish poll");
  expect(api).toHaveBeenCalledWith("/api/drafts/draft123/publish", { method: "POST", body: { version: 3 } });
  expect(container.textContent).toContain("Published: /polls/live123");
});
test("preview can return to editing without losing options", async () => {
  api.mockResolvedValue(draft);
  await render("/drafts/draft123/edit"); await click("Preview poll"); await click("Back to editing");
  expect(container.querySelector("#option-0").value).toBe("Park");
  expect(container.querySelector('input[value="after_close"]').checked).toBe(true);
});
test("stale save errors keep local edits and do not publish", async () => {
  api.mockImplementation((path, options) => options ? Promise.reject(new Error("This draft changed in another tab.")) : Promise.resolve(draft));
  await render("/drafts/draft123/edit"); await type("#question", "Keep this edit"); await click("Preview poll");
  expect(container.querySelector("#question").value).toBe("Keep this edit");
  expect(container.querySelector('[role="alert"]').textContent).toContain("changed in another tab");
  expect(api.mock.calls.some(([path]) => path.endsWith("/publish"))).toBe(false);
});
test("my drafts handles untitled polls and opens private edit links", async () => {
  api.mockResolvedValue([{ ...draft, question: "" }]);
  await render("/drafts");
  expect(container.textContent).toContain("Untitled poll");
  expect(container.querySelector(".poll-card").getAttribute("href")).toBe("/drafts/draft123/edit");
  expect(container.textContent).toContain("Private draft");
});

test("adding or removing an option after a save marks unsaved changes", async () => {
  api.mockResolvedValue(draft);
  await render("/drafts/draft123/edit");
  await click("Add another option");
  expect(container.textContent).toContain("You have unsaved changes");
  await click("Save draft");
  expect(container.textContent).not.toContain("You have unsaved changes");
  await act(async () => container.querySelector('[aria-label="Remove option 3"]').click());
  expect(container.textContent).toContain("You have unsaved changes");
  expect(container.querySelector(".back-link").textContent).toContain("My drafts");
});

test("a failed draft load can be retried without leaving the editor", async () => {
  api.mockRejectedValueOnce(new Error("Connection unavailable."));
  await render("/drafts/draft123/edit");
  expect(container.querySelector('[role="alert"]').textContent).toContain("Connection unavailable");
  api.mockResolvedValueOnce(draft);
  await click("Try again");
  expect(container.querySelector("#question").value).toBe(draft.question);
});
