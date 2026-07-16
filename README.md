# Earth Games Chat

Real-time Minecraft-themed chat app with username/password login and registration.

## What changed from your original version

- **Fixed a broken path**: your old `server.js` served `../client`, a folder
  that didn't exist alongside your uploaded files. All files now sit flat in
  the project root (no subfolders) so they're easy to upload through GitHub's
  web interface, which doesn't support drag-and-drop folder uploads.
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
and it can't store `users.json`. This repo is set up for a specific split:
**frontend on GitHub Pages, backend running locally on your own machine.**

### Important limitation of this setup

A backend running on your machine (`localhost:3000`) is only reachable from
**your own browser**. If a friend opens your GitHub Pages URL, their browser
has no way to reach your `localhost` — so this setup is for your own testing,
not for other people to actually use the chat. If you want other people to log
in and chat, the backend needs to run somewhere with a public address (a free
tier on Render, Railway, or Fly.io works well and needs no code changes beyond
what's already here — just update the two config values below to point at it
instead of `localhost`).

### How the local + Pages split works here

1. **Run the backend locally:**
   ```bash
   npm install
   npm start
   ```
   This starts the server at `http://localhost:3000`.

2. **Set the allowed origin** so the server accepts requests from your Pages
   site. Either edit the default in `server.js`:
   ```js
   const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://itsnotmesae.github.io';
   ```
   or set it as an environment variable when starting the server:
   ```bash
   ALLOWED_ORIGIN=https://itsnotmesae.github.io npm start
   ```

3. **Push these files to GitHub Pages** (or your Pages branch/folder). The
   client already points at `http://localhost:3000` by default (see
   `API_BASE` near the top of `app.js`). Change it there if your backend runs
   on a different port. Since everything is flat with no subfolders, you can
   drag `index.html`, `app.js`, and `style.css` straight into GitHub's
   "Add file → Upload files" screen — just make sure you don't also upload
   `server.js`, `package.json`, `.gitignore`, or `README.md` to the *Pages*
   publishing branch/folder if you're keeping frontend and backend in
   separate places. If it's all one repo, that's fine — Pages will just ignore
   the non-HTML/CSS/JS files when it builds the site.

4. **Cross-origin cookies:** set `CROSS_ORIGIN=true` when starting the server
   so the session cookie is sent as `SameSite=None; Secure`, which is required
   for a cookie to travel from `localhost` to a request made by
   `github.io`:
   ```bash
   CROSS_ORIGIN=true ALLOWED_ORIGIN=https://itsnotmesae.github.io npm start
   ```
   **Browser caveat:** `Secure` cookies normally require HTTPS. Chrome and
   Edge treat `localhost` as a secure context and will accept this over plain
   HTTP, so testing in Chrome/Edge should work. Firefox and Safari are
   stricter about this and may silently drop the cookie — if login seems to
   "work" (200 response) but you get logged out immediately after, try Chrome,
   or run the backend behind HTTPS (a tool like `ngrok` can give you a
   temporary HTTPS tunnel to `localhost` for testing).

5. **Open your GitHub Pages URL** with the backend running, and try
   registering. Keep the local server running in a terminal the whole time
   you're testing — closing it will disconnect the chat and break login.

### If you decide you want this usable by other people later

Deploy `server.js` + `package.json` (the whole repo, really) to Render,
Railway, or Fly.io instead of running it locally. Update `ALLOWED_ORIGIN` to
your Pages URL and `API_BASE` in `app.js` to your new backend's URL — no other
code changes needed.

## Notes on the account storage

- `users.json` is created automatically on first registration, in the same
  folder as `server.js` on whatever machine runs the backend. **Don't upload
  it to GitHub** — it holds password hashes. It's listed in `.gitignore`, but
  since everything is flat now, double check it's not sitting in your repo
  before you push (it also isn't needed there — it gets created fresh wherever
  `server.js` actually runs, e.g. your local machine).
- The server also blocks direct HTTP access to `server.js`, `package.json`,
  `.gitignore`, `README.md`, and `users.json` even though they're served from
  the same folder as the frontend files — visiting `yoursite.com/server.js`
  in a browser will return a 404 instead of the file contents.
- Sessions live in memory, so restarting the server logs everyone out. That's
  fine for a hobby project; a persistent session store (e.g. Redis) would fix
  this if you need people to stay logged in across restarts.
