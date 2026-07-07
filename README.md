# Ocean of Magda 📖🌸

A pretty, pink **static** website to search ~78,000 free public-domain books from
[Project Gutenberg](https://www.gutenberg.org), download them (EPUB / PDF /
Kindle / text), and **read EPUBs right in your browser** — with reading-light
themes, adjustable type, and a whole-book progress bar.

No server, no build step, no dependencies to install. It's plain HTML/CSS/JS, so
it runs anywhere — including **GitHub Pages, for free**.

👉 **Live demo:** `https://YOUR-USERNAME.github.io/ocean-of-magda/`

---

## Put it live on GitHub Pages

### Easiest — drag & drop in the browser (~2 minutes)

1. Go to **github.com → New repository**. Name it `ocean-of-magda`, make it
   **Public**, and click **Create repository**.
2. On the new repo page, click **“uploading an existing file.”**
3. Open this `ocean-of-magda` folder on your computer, select **everything
   inside it** (`index.html`, `app.js`, `style.css`, and the `vendor` folder),
   and **drag it onto the GitHub upload page.** Click **Commit changes**.
4. Go to the repo's **Settings → Pages**.
5. Under **Build and deployment → Source**, choose **Deploy from a branch**,
   pick branch **`main`** and folder **`/ (root)`**, then **Save**.
6. Wait ~1 minute, refresh, and GitHub shows your live link:
   **`https://YOUR-USERNAME.github.io/ocean-of-magda/`** 🎉

> ⚠️ Make sure `index.html` ends up at the **top level** of the repo (you should
> see it directly in the repo's file list — not inside another folder). If you
> accidentally drag the *folder* instead of its contents, your site will live at
> `.../ocean-of-magda/ocean-of-magda/` instead.

### Fully automatic — with git (auto-redeploys on every push)

This folder ships with a GitHub Actions workflow (`.github/workflows/deploy.yml`)
that rebuilds the live site every time you push.

```bash
cd ocean-of-magda
git init && git add -A && git commit -m "Ocean of Magda"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ocean-of-magda.git
git push -u origin main
```

Then, one time: repo **Settings → Pages → Source → “GitHub Actions.”** Every
future `git push` redeploys automatically — no more manual steps.

> Use **one** method, not both: pick "Deploy from a branch" **or** "GitHub
> Actions" as your Pages source.

---

## What works (and why)

| Feature | Works on the live site? | Notes |
|---|---|---|
| Search the whole catalogue | ✅ | Uses the Gutendex API, which allows browser calls |
| Book covers, popularity | ✅ | |
| Download EPUB / PDF / Kindle / text | ✅ | Links straight to Project Gutenberg |
| “Read online” | ✅ | Opens Gutenberg's HTML edition in a new tab |
| **Read an EPUB in the browser** | ✅ | Click **“Open an EPUB to read”** (or drag an `.epub` onto the page). Themes, fonts, layout, and a whole-book progress bar. The file stays on your device — nothing is uploaded. |

**Why you open the EPUB yourself:** Project Gutenberg doesn't allow other
websites to read its files directly (a browser security rule called CORS), so the
site can't stream a book straight into the reader. Download the EPUB (one click),
then open it in the reader. Everything happens locally in your browser.

Want the version that auto-downloads books to a folder on your computer and fills
a local library? That's the separate **Flask app** — it needs Python and can't
run on GitHub Pages, but it does all of that on your own machine.

---

Books and metadata come from **Project Gutenberg** via **Gutendex**. All titles
are public domain. Reader powered by **epub.js**.
