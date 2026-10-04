# Longchase-Entreprise

Longchase Enterprise Limited website for general supplies, procurement, and printing.

A one-page site for Longchase Enterprise Limited (general supplies,
procurement, and printing), built to match the roll-up banner: navy
and gold theme, Montserrat/Open Sans/Pinyon Script fonts.

```
longchase-site/
├── index.html          the whole site (one page, anchor navigation)
├── css/style.css        theme, layout, components
├── js/main.js            mobile nav, form validation, small UX behaviors
└── server/               optional backend for the contact form
    ├── server.js
    ├── package.json
    ├── .env.example
    └── data/              submissions.json is created here at runtime
```

## Option A — just the website, no backend

Open `index.html` directly in a browser, or upload the whole folder to
any static host (Netlify, GitHub Pages, cPanel, etc.). Everything
works, **except** the contact form will fall back to opening the
visitor's own email app instead of sending silently — there's no
server to hand it to.

## Option B — website + contact form backend

This adds a small Node/Express server that receives contact form
submissions, validates them again server-side, saves them, and can
email them to you if you provide SMTP details. It also serves the
website itself, so you only need to run one thing.

1. Install [Node.js](https://nodejs.org) (v18 or newer) if you don't have it.
2. In a terminal:
   ```
   cd server
   npm install
   cp .env.example .env
   npm start
   ```
3. Open **http://localhost:3000** — that's the full site, with the
   contact form now posting to the server.

By default, submissions are just saved to `server/data/submissions.json`
and printed to the terminal — nothing else to configure. To have them
emailed to you as well, open `server/.env` and fill in your SMTP
details (for Gmail, use an "App Password", not your normal one):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
CONTACT_TO_EMAIL=longchaseenterpriselimited@gmail.com
```

### Reading stored submissions

Set `ADMIN_TOKEN` in `.env` to any secret string, then visit:
```
http://localhost:3000/api/contact
```
with an `x-admin-token` header matching that value (e.g. via a
browser extension, Postman, or `curl -H "x-admin-token: yoursecret" http://localhost:3000/api/contact`).
Leave `ADMIN_TOKEN` blank to keep this disabled.

### Deploying the backend

Any Node hosting works — Render, Railway, Fly.io, or a plain VPS with
`pm2`. Set the same environment variables there as in `.env`, and
point your domain at it. The frontend needs no changes: it always
tries `/api/contact` on whatever host it's served from.

## Editing the site

- **Colours, fonts, spacing** — all defined once at the top of
  `css/style.css` as CSS custom properties (`--navy-950`, `--gold-500`,
  `--font-display`, etc.). Change them there and they apply everywhere.
- **Text content, services, contact details** — edit directly in
  `index.html`; it's plain, readable markup with one section per part
  of the page.
- **Logo** — currently a recreated monogram in inline SVG (no original
  logo file was available). Swap in a real logo image whenever you
  have one.
