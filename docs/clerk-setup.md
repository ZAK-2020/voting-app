# Clerk authentication for Gather

## Accounts and existing data

Use a separate Clerk application for Gather, not the AI support app's keys. New identities are stored in `clerkusers`, uniquely keyed by `clerkId`. No passwords are stored for these accounts, and no email lookup links them to legacy users.

Legacy `users`, polls, drafts, and ballots remain untouched. Existing public polls retain their original organizer names. New accounts cannot manage legacy polls or see legacy private drafts, even with a matching email. A new identity also does not inherit an old vote receipt; the one-vote rule applies to the new account, not to a verified real-world person. Old `/api/register` and `/api/login` endpoints return HTTP 410 and legacy JWTs are rejected.

The backend verifies the Clerk session signature, expiry and authorized frontend origin, then checks the current Clerk user's **primary email** is verified. Pending sessions, banned/locked accounts and deleted Clerk users are rejected. This backend check applies to private drafts, voting and all organizer operations. Public reading without a token remains available. The browser obtains current tokens from Clerk for API calls and CSV exports instead of storing JWTs in localStorage.

## Configure the voting application

1. In the [Clerk dashboard](https://dashboard.clerk.com/), create **Gather Voting** as a separate application.
2. Enable **Google** as a social connection. Enable email signup only with **verification required**; Clerk sends the verification messages. Resend is not needed. Follow Clerk's [Google setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google) and [signup options](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options).
3. Configure sign-in and sign-up paths as `/login` and `/register` where the dashboard requests application paths. The React components also set these explicitly. Use the same instance for the frontend publishable key and backend secret key.
4. For local work, put `REACT_APP_CLERK_PUBLISHABLE_KEY` in `frontend/.env` and `CLERK_SECRET_KEY` in `backend/.env`. Restart both processes after changing keys. `npm run start:local` sets `CLIENT_URL=http://localhost:5001`; for authenticated LAN testing, update that local origin list to include the exact LAN frontend origin too. OAuth on a phone must also satisfy Clerk/Google's allowed-origin requirements.

## Vercel and Railway configuration

Vercel (root directory `frontend`):

```env
REACT_APP_API_URL=https://voting-app-production-b4bf.up.railway.app
REACT_APP_SOCKET_URL=https://voting-app-production-b4bf.up.railway.app
REACT_APP_CLERK_PUBLISHABLE_KEY=<voting-app publishable key>
```

Railway (root directory `backend`):

```env
MONGO_URI=<existing voting database connection string>
CLIENT_URL=https://voting-app-five-kohl.vercel.app
CLERK_SECRET_KEY=<same voting-app instance secret key>
SERVE_FRONTEND=false
```

Keep the existing Railway `PORT` setup. `JWT_SECRET` is no longer used for app authentication and may be removed after cutover. Never place `CLERK_SECRET_KEY` in Vercel's frontend variables or any `REACT_APP_*` variable. The frontend publishable key is intentionally public.

`CLIENT_URL` is an exact, comma-separated origin allowlist shared by CORS and Clerk's `authorizedParties` token check. Include scheme and port, with no paths. Add any intentionally supported preview origins explicitly; do not use a wildcard.

Without a frontend key, public browsing still works and the sign-in page explains that signup is not ready. Without backend Clerk configuration, authenticated requests fail closed. This permits builds without credentials; it is not a deployment-ready login configuration.

Clerk development instances are for testing. Clerk's [production setup](https://clerk.com/docs/guides/development/deployment/production) requires an owned domain, DNS configuration, and your own Google OAuth credentials. The existing `vercel.app` address alone does not meet the owned-domain requirement. When changing to a custom domain, update all app URLs and allowed origins above. Do not describe a deployment with development keys as production-ready.

## Release checks

Configure and test Clerk before deploying this authentication replacement. Deploy both frontend and backend; an old frontend cannot use the retired password endpoints.

- Sign up with an email you control and confirm verification is required.
- Sign in through Google, then create a draft, publish, vote and export a CSV.
- Open a shared poll while signed out, sign in, and confirm you return to that poll.
- Refresh, sign out and switch accounts; private drafts and vote receipts must stay account-specific.
- Open account settings from the account name in the header.
- Confirm an old password account is not linked to the new identity and cannot use old JWTs.

Local regression tests mock Clerk's external profile service while exercising real API routes and isolated MongoDB databases. A separate test runs the real Clerk SDK against a locally generated signing key and intercepted JWKS response to check signatures, expiry and origin restrictions. Frontend tests cover session changes, verification errors, fresh token retrieval and safe return URLs. These checks do not replace a real Google redirect and inbox-verification test with configured Clerk keys.
