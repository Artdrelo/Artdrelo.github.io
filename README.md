# Jorge Andrés Gómez — Portfolio

A static portfolio site (plain HTML/CSS/JS, no build step) for GitHub Pages.

## Files

```
index.html          page structure and text (hero, focus, experience, skills, about, contact)
css/style.css       all styling; colours are the variables at the top (--accent, --accent-2…)
js/projects.js      ← your projects: titles, descriptions, videos, images. Edit this most.
js/main.js          boot screen, cursor particles, hero shader, cards, project pop-up
assets/img/         covers and screenshots
assets/CV_JorgeAndresGomez.pdf   the Résumé button
```

## Publish on GitHub Pages (free) — step by step

Your site will live at **https://artdrelo.github.io**

### Option A — no command line (easiest)

1. Sign in at https://github.com.
2. Click **+** (top right) → **New repository**.
3. Repository name: **`Artdrelo.github.io`** (exactly your username + `.github.io`).
   Set it to **Public** and click **Create repository**.
4. On the empty repo page, click **uploading an existing file**.
5. Open `E:\Projects\PortfolioPage` on your computer, select `index.html`, `css`, `js`,
   `assets` and `README.md`, and drag them onto the page. Skip the hidden `.claude` folder,
   because it only holds the local preview settings.
6. Click **Commit changes**.
7. Go to **Settings → Pages**. Under *Build and deployment* choose
   **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**, then **Save**.
8. Wait 1–2 minutes, then open https://artdrelo.github.io

To update later, open the file on GitHub, click the pencil icon, edit and commit.
Or upload the changed file again.

### Option B — with Git

```bash
cd E:/Projects/PortfolioPage
git init
git add .
git commit -m "Portfolio site"
git branch -M main
git remote add origin https://github.com/Artdrelo/Artdrelo.github.io.git
git push -u origin main
```
Then do step 7 above.

## Editing content

- **Add a project:** copy one `{ ... }` block in `js/projects.js`, change the fields and put the
  cover image in `assets/img/`. `featured: true` puts it in the big top grid.
- **Videos:** use the YouTube ID from `youtube.com/watch?v=THIS_PART`.
  Several Behance-only videos are embedded with `type: "adobe"`. They currently play, but they
  depend on Behance. Re-uploading them to YouTube (unlisted is fine) and switching to
  `{ type: "youtube", id: "..." }` makes them permanent.
  You can also drop an `.mp4` in `assets/video/` and use `{ type: "file", src: "assets/video/clip.mp4" }`.
  Keep each file under 100 MB, the GitHub limit.
- **Custom video thumbnail:** add `poster: "assets/img/whatever.jpg"` to any video entry.
- **Colours:** change `--accent` / `--accent-2` at the top of `css/style.css`.

## Preview locally

```bash
python -m http.server 8000
```
Run it inside this folder, then open http://localhost:8000.
