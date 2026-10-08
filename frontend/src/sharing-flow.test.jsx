import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { api } from "./api";
import { pollShareUrl } from "./sharing";
import JoinPoll, { JoinForm } from "./components/JoinPoll";
import SharePoll from "./components/SharePoll";
import PresentationPage from "./components/PresentationPage";

jest.mock("./api", () => ({ ...jest.requireActual("./api"), api: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;
const poll = { resultsVisible: true, resultsVisibility: "always", _id: "abc123", question: "Choose our next activity", organizer: "Sam", joinCode: "ABC234", totalVotes: 0, options: [{ _id: "a", label: "Hiking", votes: 0 }, { _id: "b", label: "Bowling", votes: 0 }], closesAt: null, closedAt: null };
let container, root;
const originalShareUrl = process.env.REACT_APP_SHARE_URL;
beforeEach(() => { delete process.env.REACT_APP_SHARE_URL; container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); api.mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); jest.restoreAllMocks(); if (originalShareUrl === undefined) delete process.env.REACT_APP_SHARE_URL; else process.env.REACT_APP_SHARE_URL = originalShareUrl; });
function Location() { return <div>Poll opened: {useLocation().pathname}</div>; }
async function render(element, entry = "/") {
  await act(async () => root.render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/" element={element} /><Route path="/join/:code" element={element} /><Route path="/polls/:id/present" element={element} /><Route path="/polls/:id" element={<Location />} /></Routes></MemoryRouter>));
}
async function type(value) {
  await act(async () => { const input = container.querySelector("input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function submit() { await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
async function click(text) { await act(async () => [...container.querySelectorAll("button")].find(node => node.textContent.includes(text)).click()); }

test("join form accepts pasted lowercase codes with separators", async () => {
  api.mockResolvedValue({ pollId: poll._id });
  await render(<JoinForm />);
  await type("abc-234"); await submit();
  expect(api).toHaveBeenCalledWith("/api/join/ABC234");
  expect(container.textContent).toContain("Poll opened: /polls/abc123");
});
test("malformed codes stay in the form without a request", async () => {
  await render(<JoinForm />); await type("abc"); await submit();
  expect(api).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]').textContent).toContain("six-character");
});
test("unknown codes retain the entry and allow another attempt", async () => {
  api.mockRejectedValue(new Error("No poll matches that code."));
  await render(<JoinForm />); await type("ABC234"); await submit();
  expect(container.querySelector("input").value).toBe("ABC234");
  expect(container.querySelector("button").disabled).toBe(false);
  expect(container.textContent).toContain("No poll matches");
});
test("scanning the short URL opens the ballot without requiring sign-in first", async () => {
  api.mockResolvedValue({ pollId: poll._id });
  await render(<JoinPoll />, "/join/ABC234");
  expect(container.textContent).toContain("Poll opened: /polls/abc123");
});
test("sharing uses the configured network URL and offers a manual copy fallback", async () => {
  process.env.REACT_APP_SHARE_URL = "http://192.168.0.190:5001";
  Object.defineProperty(navigator, "clipboard", { value: { writeText: jest.fn().mockRejectedValue(new Error("Not permitted")) }, configurable: true });
  await render(<SharePoll poll={poll} />);
  expect(container.querySelector("input").value).toBe("http://192.168.0.190:5001/join/ABC234");
  expect(container.querySelector("svg path")).not.toBeNull();
  await click("Copy link");
  expect(document.activeElement).toBe(container.querySelector("input"));
  expect(container.querySelector('[role="status"]').textContent).toContain("Link selected");
});
test("invalid share origins fall back to the current website", () => {
  process.env.REACT_APP_SHARE_URL = "javascript:alert(1)";
  expect(pollShareUrl(poll)).toBe(window.location.origin + "/join/ABC234");
});
test("presentation refreshes results while preserving its join code", async () => {
  api.mockResolvedValue(poll);
  await render(<PresentationPage revision={0} connected />, "/polls/abc123/present");
  expect(container.textContent).toContain("The first vote gets things started.");
  api.mockResolvedValue({ ...poll, totalVotes: 1, options: [{ ...poll.options[0], votes: 1 }, poll.options[1]] });
  await render(<PresentationPage revision={1} connected />, "/polls/abc123/present");
  expect(container.textContent).toContain("100%");
  expect(container.textContent).toContain("Hiking is leading so far.");
  expect(container.textContent).toContain("ABC234");
});
test("closed presentation invites viewers to see results and fullscreen fails gracefully", async () => {
  api.mockResolvedValue({ ...poll, closedAt: "2025-01-01T00:00:00Z" });
  await render(<PresentationPage revision={0} connected />, "/polls/abc123/present");
  expect(container.textContent).toContain("Scan to view");
  expect(container.textContent).not.toContain("Scan to vote");
  await click("Fullscreen");
  expect(container.querySelector('[role="status"]').textContent).toContain("not supported");
});

test("restricted presentation hides rankings but keeps QR participation available", async () => {
  api.mockResolvedValue({ ...poll, resultsVisible: false, resultsVisibility: "after_vote", totalVotes: 1, options: poll.options.map(({ votes, ...option }) => option) });
  await render(<PresentationPage revision={0} connected />, "/polls/abc123/present");
  expect(api).toHaveBeenCalledWith("/api/polls/abc123?view=presentation");
  expect(container.textContent).toContain("Results are hidden");
  expect(container.textContent).toContain("Scan to vote");
  expect(container.querySelector(".result-track")).toBeNull();
  expect(container.textContent).not.toContain("NaN");
  api.mockResolvedValue({ ...poll, closedAt: "2025-01-01T00:00:00Z", totalVotes: 1, options: [{ ...poll.options[0], votes: 1 }, poll.options[1]] });
  await render(<PresentationPage revision={1} connected />, "/polls/abc123/present");
  expect(container.textContent).toContain("100%");
  expect(container.textContent).not.toContain("Results are hidden");
});
