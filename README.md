# Earth Games Chat

Real-time Minecraft-themed chat app with username/password login and registration.

## What changed from your original version

- **Fixed a broken path**: your old `server.js` served `../client`, a folder that
  didn't exist alongside your uploaded files. Everything now lives correctly
  under `public/`, and `server.js` serves from there.
- **Added real accounts**: register/login with a username and password instead
  of just claiming a display name each session.
  - Passwords are hashed with Node's built-in `scrypt` (salted, never stored in
    plain text).
  - Sessions are cookie-based (`HttpOnly`, so client-side JS can't read them).
  - Accounts are stored in `users.json` next to `server.js`. This is fine for a
    small personal server; swap it for a real database later if you need to
    scale.
- **Socket connections are now authenticated** — the server checks your
  session cookie before letting a socket join the chat, so you can't spoof a
  username by just calling the socket API directly.
- Small chat fixes: duplicate "user joined" messages when the same account had
  multiple tabs open, an "X, Y are typing" grammar fix, and a "(you)" tag on
  your own entry in the player list.

## Running it locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## ⚠️ About hosting this on GitHub

**GitHub Pages cannot run this app as-is.** Pages only serves static files
(HTML/CSS/JS) — it can't run `server.js` or keep a Socket.IO connection alive,
and it can't store `users.json`. If you try to host just the `public/` folder
on Pages, the login form and chat will have nothing to talk to.

You have two realistic options:

### Option A — Host the whole thing on a Node-friendly platform (recommended)
Push this repo to GitHub, then deploy it on a service that runs persistent
Node processes, e.g. **Render**, **Railway**, or **Fly.io** (all have free/cheap
tiers). Point them at this repo, set the start command to `npm start`, and
they'll host both the frontend and backend together — no code changes needed.

### Option B — Split frontend and backend
Keep the backend (`server.js`, `package.json`, `users.json`) on a Node host
(Render/Railway/etc.), and host only `public/` on GitHub Pages. You'd then
need to point `app.js`'s `fetch(...)` calls and `io(...)` connection at your
backend's URL instead of relative paths (e.g. `io("https://your-backend.com")`),
and enable CORS on the server for your Pages domain. This is more setup for no
real benefit unless you specifically want the frontend on a `github.io` URL.

**If you just want it live quickly, Option A is simplest** — one deploy, one
URL, everything works out of the box.

## Notes on the account storage

- `users.json` is created automatically on first registration. Don't commit it
  to a public GitHub repo — add it to `.gitignore` (included) so you don't leak
  password hashes.
- Sessions live in memory, so restarting the server logs everyone out. That's
  fine for a hobby project; a persistent session store (e.g. Redis) would fix
  this if you need people to stay logged in across restarts.
