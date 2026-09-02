# haydnmcintyre.ca

Personal site and portfolio for Haydn McIntyre. Two pages in one document: a
home page about the websites, web applications and mobile apps I build, and a
portfolio page with the projects behind it. The whole site is one continuous
push forward through a starfield, with the brass HM mark hanging ahead of you
in the hero and every section arriving from the vanishing point as you scroll.

Plain HTML, CSS and JavaScript. No framework, no build step, no npm. three.js
is vendored as a single file so that stays true.

## Files

| | |
| --- | --- |
| `index.html` | Both pages. The URL picks one before first paint; links switch between them |
| `styles.css` | All styling. Design tokens are at the top of the file |
| `script.js` | Page switching, the scroll tick (hero beats, section approach, nebula), carousels, contact form |
| `space-scene.js` | The WebGL backdrop: stars, wave grids and the 3D mark the camera flies through |
| `vendor/three.module.min.js` | three.js 0.184.0, loaded by `space-scene.js` |
| `functions/api/contact.js` | Contact form endpoint, deployed by Cloudflare Pages |
| `_redirects` | Serves `index.html` at `/portfolio`, and points the old `portfolio.html` at it |
| `assets/work/` | Project screenshots |

## Running it

Open `index.html` in a browser. There is nothing to install and nothing to
compile. Opened straight from disk the WebGL scene cannot load (browsers block
module imports on `file://`), so the static brass mark shows instead; serve the
folder over HTTP to see the scene. Add `?p=portfolio` to open the portfolio
page from disk, where `/portfolio` does not exist.

## Deploying

Cloudflare Pages builds from `main` automatically:

```bash
git add .
git commit -m "what changed"
git push
```

Live about a minute later. Build command is empty and the output directory is
the repository root.

## Notes

**Both pages are one file.** `/portfolio` is a Cloudflare rewrite that serves
`index.html` unchanged; a two line script in the head reads the URL and shows
the right page before anything paints, and clicking between them uses
`pushState` so the address bar and the back button behave. Without JavaScript
both pages read top to bottom as one document.

**Motion honours `prefers-reduced-motion`.** It disables the entrance
animations, the section approach and the camera ride, and the scene's clock
stops. `?still=1` on the URL does the same on demand, which is how the site is
screenshotted.

**The contact form posts to `/api/contact`,** which is
`functions/api/contact.js` in this repository. Cloudflare Pages turns anything
under `functions/` into a live endpoint at deploy time, so there is still no
build step. It mails the message through Cloudflare's own sending API, which is
free when the recipient is a verified Email Routing destination on the same
account. It is switched on with four environment variables on the Pages project,
listed in the comment at the top of the file. Until they are set the endpoint
answers 501 and the form falls back to opening the visitor's mail app, so it is
never a dead end and nothing has to be configured for the site to ship.

**The email address is never in the markup.** `script.js` assembles it at
runtime and fills any element marked `data-mail`, so scrapers reading the raw
HTML find nothing. To change it, edit the `mailUser` and `mailHost` lines at the
top of `script.js`.

**Adding a project.** Copy a `<section class="sec">` block inside
`<main id="portfolio-page">` in `index.html` and swap the contents. The
`.project` grid puts copy on the left and the showcase on the right; add
`project-wide` for the 4/8 split the carousels use. Each section's content
sits in one `.approach` panel, which is what flies in as you scroll, so keep
the new section's content inside one too.
