import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import { api, downloadResults } from "./api";
import PollPage from "./components/PollPage";
import HomePage from "./components/HomePage";
import AuthPage from "./components/AuthPage";
import CreatePoll from "./components/CreatePoll";

jest.mock("./api", () => ({ ...jest.requireActual("./api"), api: jest.fn(), downloadResults: jest.fn() }));
jest.mock("@clerk/react", () => ({ SignIn: () => null, SignUp: () => null }));
global.IS_REACT_ACT_ENVIRONMENT = true;
const poll = { resultsVisible: true, resultsVisibility: "always", _id: "abc123", question: "Where should we meet?", organizer: "Sam", createdBy: "owner", totalVotes: 0, options: [{ _id: "park", label: "Park", votes: 0 }, { _id: "cafe", label: "Cafe", votes: 0 }], closesAt: null, closedAt: null };
let container, root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); api.mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
function Location() { const location = useLocation(); return <div>{location.pathname} Return to: {location.state?.from}</div>; }
async function render(element, user = null, entry = "/polls/abc123") {
  await act(async () => root.render(<AuthContext.Provider value={{ user, login: jest.fn() }}><MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/polls/:id" element={element} /><Route path="/" element={element} /><Route path="/login" element={<Location />} /><Route path="/drafts/:id/edit" element={<Location />} /></Routes></MemoryRouter></AuthContext.Provider>));
}
const button = text => [...container.querySelectorAll("button")].find(node => node.textContent.includes(text));
async function click(node) { await act(async () => node.click()); }

test("guests return to the shared poll after choosing sign in", async () => {
  api.mockResolvedValue(poll);
  await render(<PollPage revision={0} connected />);
  expect(container.querySelector("fieldset").disabled).toBe(true);
  await click([...container.querySelectorAll("a")].find(node => node.textContent === "Sign in to vote"));
  expect(container.textContent).toContain("/login Return to: /polls/abc123");
});

test("selecting an option waits for explicit submission, then shows a persistent receipt", async () => {
  api.mockImplementation(path => Promise.resolve(path.endsWith("/ballot") ? { optionId: null } : poll));
  await render(<PollPage revision={0} connected />, { _id: "voter" });
  expect(button("Submit vote").disabled).toBe(true);
  await click(container.querySelector('input[value="park"]'));
  expect(api.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  expect(button("Submit vote").disabled).toBe(false);
  api.mockResolvedValueOnce({ optionId: "park", poll: { ...poll, totalVotes: 1, options: [{ ...poll.options[0], votes: 1 }, poll.options[1]] } });
  await click(button("Submit vote"));
  expect(container.textContent).toContain("Your vote is recorded.");
  expect(container.textContent).toContain("100%");
  expect(container.querySelectorAll('input[type="radio"]').length).toBe(0);
});

test("saved votes restore on page load and results handle a tie", async () => {
  api.mockImplementation(path => Promise.resolve(path.endsWith("/ballot") ? { optionId: "cafe" } : { ...poll, totalVotes: 2, options: poll.options.map(option => ({ ...option, votes: 1 })) }));
  await render(<PollPage revision={0} connected />, { _id: "voter" });
  expect(container.textContent).toContain("You chose Cafe.");
  expect(container.textContent).toContain("It's a tie so far.");
  expect(container.querySelectorAll('input[type="radio"]').length).toBe(0);
});

test("an expired poll shows final results without voting controls", async () => {
  api.mockResolvedValue({ ...poll, closesAt: "2020-01-01T00:00:00.000Z" });
  await render(<PollPage revision={0} connected />);
  expect(container.textContent).toContain("Final results");
  expect(container.textContent).toContain("No votes yet.");
  expect(container.querySelector("form")).toBeNull();
});

test("dashboard filters open, closed, and owned polls", async () => {
  api.mockResolvedValue([poll, { ...poll, _id: "other", question: "Which day?", createdBy: "other", closedAt: "2020-01-01T00:00:00.000Z" }]);
  await render(<HomePage revision={0} />, { _id: "owner" }, "/");
  expect(container.querySelectorAll(".poll-card").length).toBe(2);
  await click(button("Closed"));
  expect(container.querySelector(".poll-card").textContent).toContain("Which day?");
  await click(button("My polls"));
  expect(container.querySelector(".poll-card").textContent).toContain("Where should we meet?");
});

test("missing Clerk setup shows guidance instead of a broken signup form", async () => {
  await render(<AuthPage />, null, "/");
  expect(container.querySelector('[role="status"]').textContent).toContain("Sign-in is being set up");
  expect(container.querySelector("form")).toBeNull();
});

test("after-close voters see their receipt but no distribution or vote controls", async () => {
  const hidden = { ...poll, resultsVisibility: "after_close", resultsVisible: false, totalVotes: 1, options: poll.options.map(({ votes, ...option }) => option) };
  api.mockImplementation(path => Promise.resolve(path.endsWith("/ballot") ? { optionId: "park" } : hidden));
  await render(<PollPage revision={0} connected />, { _id: "voter" });
  expect(container.textContent).toContain("You chose Park.");
  expect(container.textContent).toContain("Results are hidden");
  expect(container.querySelector(".result-track")).toBeNull();
  expect(container.querySelector("form")).toBeNull();
  expect(container.textContent).not.toContain("NaN");
});

test("after-vote polls remain votable with no early results link", async () => {
  api.mockImplementation(path => Promise.resolve(path.endsWith("/ballot") ? { optionId: null } : { ...poll, resultsVisibility: "after_vote", resultsVisible: false, options: poll.options.map(({ votes, ...option }) => option) }));
  await render(<PollPage revision={0} connected />, { _id: "voter" });
  expect(container.textContent).toContain("Cast your vote to see the results");
  expect(button("View current results")).toBeUndefined();
  await click(container.querySelector('input[value="park"]'));
  expect(button("Submit vote").disabled).toBe(false);
});

test("creator saves the chosen visibility mode in an unfinished draft", async () => {
  api.mockResolvedValue({ _id: "abc123" });
  await render(<CreatePoll />, { _id: "owner" }, "/");
  await click(container.querySelector('input[value="after_close"]'));
  await click(button("Save draft"));
  expect(api).toHaveBeenCalledWith("/api/drafts", expect.objectContaining({ body: expect.objectContaining({ resultsVisibility: "after_close" }) }));
});

test("Archive tab fetches archived polls separately from the main dashboard", async () => {
  api.mockImplementation(path => Promise.resolve(path.includes("archived=true") ? [{ ...poll, _id: "archived", question: "Old decision", closedAt: "2025-01-01", archivedAt: "2025-01-02" }] : [poll]));
  await render(<HomePage revision={0} />, { _id: "owner" }, "/");
  await click(button("Archive"));
  expect(api).toHaveBeenCalledWith("/api/polls?archived=true");
  expect(container.querySelector(".poll-card").textContent).toContain("Old decision");
  expect(container.querySelector(".badge").textContent).toContain("Archived");
  await click(button("All polls"));
  expect(container.querySelector(".poll-card").textContent).toContain("Where should we meet?");
});

test("organizer can archive and restore a closed poll without reopening voting", async () => {
  const closed = { ...poll, closedAt: "2025-01-01" };
  api.mockImplementation((path, options) => Promise.resolve(path.endsWith("/ballot") ? { optionId: null } : path.endsWith("/archive") ? { ...closed, archivedAt: "2025-01-02" } : closed));
  await render(<PollPage revision={0} connected />, { _id: "owner" });
  await click(button("Archive poll"));
  expect(container.textContent).toContain("Poll archived.");
  expect(button("Restore poll")).toBeDefined();
  await click(button("Restore poll"));
  expect(container.textContent).toContain("Voting remains closed.");
  expect(button("Submit vote")).toBeUndefined();
});

test("export is disabled for hidden results and reports download failures", async () => {
  api.mockImplementation(path => Promise.resolve(path.endsWith("/ballot") ? { optionId: null } : { ...poll, resultsVisibility: "after_close", resultsVisible: false }));
  await render(<PollPage revision={0} connected />, { _id: "owner" });
  expect(button("Export CSV").disabled).toBe(true);
  api.mockImplementation(path => Promise.resolve(path.endsWith("/ballot") ? { optionId: null } : poll));
  await render(<PollPage revision={1} connected />, { _id: "owner" });
  downloadResults.mockRejectedValueOnce(new Error("Download failed. Try again."));
  await click(button("Export CSV"));
  expect(container.querySelector('[role="alert"]').textContent).toContain("Download failed");
  expect(button("Export CSV").disabled).toBe(false);
});
