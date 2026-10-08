# Gather — Voting App

A real-time voting application built with React (frontend), Node.js/Express (backend), MongoDB, and Socket.IO.

## Local development

Start MongoDB on `127.0.0.1:27017`. In `backend/.env`, set a random `JWT_SECRET` (never commit it).

In one terminal, from `backend/`, run:

```powershell
npm ci
npm run start:local
```

This explicit local entry point uses `voting_app_local` on port 5000, regardless of the cloud URI in `.env`.

In `frontend/.env`, set:

```env
REACT_APP_API_URL=
REACT_APP_SOCKET_URL=
PORT=5001
BROWSER=none
```

In another terminal, from `frontend/`, run `npm ci`, then `npm start`. Open http://localhost:5001.

The development server proxies API and Socket.IO requests to port 5000. Keeping these two URLs empty lets phones on the same network use the frontend's address for both requests and live updates.

For phone testing, open `http://<your-computer-LAN-IP>:5001` on both devices. If presenting from `localhost`, optionally set `REACT_APP_SHARE_URL=http://<your-computer-LAN-IP>:5001` in `frontend/.env.development.local` and restart the frontend. This makes QR codes use the LAN address without embedding it in production builds. Both devices must be on the same reachable network and the computer must allow incoming traffic on port 5001. No public hosting is enabled by this setup.

Register an account, create a poll, and share its `/polls/:id` link. Every registered user can create polls. Public visitors can view poll questions; results follow the creator's visibility setting. Sign-in is required to vote. Each account can vote once in each poll. Poll creators can close voting; deadlines are enforced on the server. Published questions/options and visibility settings cannot be edited.

## Drafts, previews, and duplication

- **Create poll → Save draft** stores unfinished questions/options privately. Find and resume them from **My drafts**. Save explicitly before leaving; unsaved edits show a reminder and closing/reloading the tab prompts a browser warning.
- **Preview poll** validates the question, distinct options, and future deadline, saves the current draft, and displays a non-voting ballot preview with the chosen results rule. Return to editing or choose **Publish poll**.
- Drafts live in a separate `drafts` collection and require owner authentication for every read/write. They have no join code, public directory entry, live broadcast, or voting endpoint.
- Draft revisions prevent overwriting changes from another tab. Publishing uses the draft ID as the published poll ID and an immutable publishing snapshot, so concurrent requests/retries cannot create multiple polls. Successful publishing removes the draft; interrupted requests can resume.
- On one of your published/closed polls, **Duplicate poll** copies the question, options, and results visibility into a new private draft. The duplicate has no votes, receipts, old option IDs, join code, or closing date. Review it and select a new deadline before publishing.

## Results visibility

- **Always visible** (default, including existing polls): results are public.
- **After voting**: authenticated voters see results after their own vote. Results become public once voting closes.
- **After closing**: everyone, including the creator and voters, waits for manual closing or the deadline.
- Presentation requests use `?view=presentation` and keep restricted results hidden until closing, even if the presenter has voted.
- Response totals stay public. Hidden responses omit each option's vote count; no percentages or rankings are sent. This applies to list, detail, creation, and vote responses. Socket events carry only the poll ID. Authenticated responses use `Cache-Control: no-store`.
- The UI keeps the voter's own receipt visible even when the overall results are hidden. Signing out remounts the ballot to clear previously authorized results.

## Visual design

The UI uses indigo `#6366F1` (hover `#4F46E5`), purple `#8B5CF6`, background `#F8FAFC`, white cards, text `#0F172A`, secondary text `#64748B`, and borders `#E2E8F0`. Success, warning, and error accents use `#22C55E`, `#F59E0B`, and `#EF4444`. Page titles are 32–40px/700; section headings 22–24px/600; questions 22–28px/600; body 15–16px/400; buttons 14px/600; labels 14px/500; result percentages 18–22px/700.

## Joining, sharing, and presenting

- Every poll has a permanent six-character code. Codes omit easily confused characters (`0`, `1`, `I`, `O`) and have a unique database index with collision retries. Startup gives existing polls codes without changing votes or timestamps.
- Enter a code on the dashboard or `/join`. Spaces, hyphens, and lowercase letters are accepted. `/join/:code` links resolve directly to the poll, including results for closed polls.
- **Share poll** shows a locally generated QR code, a copyable short link, and an SVG download. No third-party QR service receives poll links. Clipboard-denied browsers can select and manually copy the link.
- **Present** opens `/polls/:id/present`: a clean display with live result bars, QR code, join code, connection status, and optional fullscreen. Escape exits fullscreen. This public display contains no personal voting receipts or account controls.
- Sign-in is still required to submit a vote. Join codes are shortcuts to public polls, not access-control secrets.

## Archive and CSV export

- Organizers can archive a poll after manual closing or its deadline. Archived polls leave the default dashboard and appear in its **Archive** tab. The poll URL, join code, presentation, and results remain accessible.
- **Restore poll** returns a poll to the main dashboard without altering its closing time, votes, or join code. Voting stays closed. Archiving/restoring emits the usual poll-change event for other connected viewers.
- **Export CSV** is organizer-only and uses the same results-visibility checks as the API. There is no organizer bypass: an after-vote poll requires the organizer's own vote or closure; an after-close poll requires closure. Archived polls remain exportable.
- CSV files contain one row per option with the question, counts, percentages, total responses, status, closing times, archive time, and export time. Times are ISO UTC, percentages have two decimal places, and no voter identities are exported. UTF-8 BOM and quoted CSV fields support Unicode, commas, quotes, and line breaks; formula-like text is neutralized for spreadsheet safety.
- API endpoints: `GET /api/polls?archived=true`, `POST /api/polls/:id/archive`, `POST /api/polls/:id/restore`, and `GET /api/polls/:id/export`.

## Verification

- Backend: `npm test` in `backend/` (requires local MongoDB). Tests create and remove an isolated, randomly named local database.
- Frontend: `npm test -- --watchAll=false --runInBand` in `frontend/`.
- Production compilation: `npm run build` in `frontend/`.

## Data and limits

Polls use a new `polls` collection. The legacy global options and `User.votedFor` values remain untouched but are not migrated or shown in the new dashboard; the old vote endpoints return HTTP 410.

Each poll embeds private vote receipts. A single conditional MongoDB update checks user eligibility and the deadline, records a receipt, and increments counters atomically. This works with standalone local MongoDB and prevents concurrent duplicate submissions. Public APIs and socket events never include receipts or password hashes.

This version supports up to 10,000 responses per poll to keep embedded receipts bounded. It is intended for small communities; larger scale would need separate ballot documents, a unique poll/user index, transactional updates, and paginated listing. The poll directory is public; result distributions follow the visibility policy above. Accounts establish one vote per account, not verified real-world identity.

## Project Structure

- `frontend/`: React app for Vercel
- `backend/`: Express + Socket.IO API for Railway

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=3001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=https://your-frontend-project.vercel.app
SERVE_FRONTEND=false
```

### Frontend (`frontend/.env`)

```env
REACT_APP_API_URL=https://your-backend-service.up.railway.app
REACT_APP_SOCKET_URL=https://your-backend-service.up.railway.app
```

## Deployment Notes

- Deploy `frontend/` to Vercel.
- Deploy `backend/` to Railway.
- In Vercel, set the Root Directory to `frontend`.
- In Railway, set the service root to `backend`.
- After Railway gives you a public URL, set that URL in Vercel as `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL`.
- After Vercel gives you a public URL, set that URL in Railway as `CLIENT_URL`.
