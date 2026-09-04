# haydnmcintyre.ca

Personal site and portfolio for Haydn McIntyre. Two pages in one document: a
home page about the websites, web applications and mobile apps I build, and a
portfolio page with the projects behind it. The whole site is one continuous
push forward through a starfield, with the brass HM mark hanging ahead of you
in the hero and every section arriving from the vanishing point as you scroll.

Plain HTML, CSS and JavaScript. No framework, no build step, no npm. three.js
is vendored as two files so that stays true.

## Files

| | |
| --- | --- |
| `index.html` | Both pages. The URL picks one before first paint; links switch between them |
| `styles.css` | All styling. Design tokens are at the top of the file |
| `script.js` | Page switching, the scroll tick (hero beats, section approach, nebula), carousels, contact form |
| `space-scene.js` | The WebGL backdrop: stars, wave grids and the 3D mark the camera flies through |
| `vendor/three.module.min.js` | three.js 0.184.0, loaded by `space-scene.js` |
| `vendor/three.core.min.js` | The other half of the same build; `three.module.min.js` imports it |
| `functions/api/contact.js` | Contact form endpoint, deployed by Cloudflare Pages |
| `_redirects` | Serves `index.html` at `/portfolio`, and points the old `portfolio.html` at it |
| `robots.txt` | Opens the site to crawlers, keeps them off `/api/`, points at the sitemap |
| `sitemap.xml` | The two URLs the site has |
| `og.jpg` | The 1200x630 card that shows when a link to the site is shared |
| `assets/work/` | Project screenshots, WebP |

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
listed in the comment at the top of the file, and they are set: the form sends.
They belong to the project rather than the domain, and only take effect on a
deployment made after they are saved. With any of them missing the endpoint
answers 501 and the form falls back to opening the visitor's mail app, so it is
never a dead end and nothing has to be configured for the site to ship.

**What loads, and when.** The page used to pull about 3.6 MB before it settled,
most of it before anything was readable. Three things fixed that, and all three
are easy to undo by accident:

Every screenshot on the portfolio page carries `loading="lazy"`. Both pages are
one document and the one you are not on is `display:none`, but that does not
stop an image loading, it only stops it being drawn. Without the attribute every
visitor to the home page downloaded the whole portfolio carousel, 1.7 MB of
screenshots most of them never saw. When adding a project, copy the attribute.

The screenshots are WebP, about half the size of the JPEGs they replaced at the
same quality. `og.jpg` is deliberately still a JPEG: several social scrapers
still do not take WebP, and the card is the one image whose whole job is being
read by them. New captures are converted once, by hand, and committed as WebP.
Nothing converts at deploy time and there is still no build step.

`space-scene.js` does not fetch three.js until the browser goes idle, and does
not fetch it at all when the connection reports data saver, 2g, or a device with
1 GB of memory. Those cases get the static brass mark, which is the same thing a
machine without WebGL already got, so nothing new had to be written to handle
them. The `modulepreload` hints in the head were removed for the same reason:
they told the preload scanner to pull 732 KB of vendor code while the stylesheet,
the fonts and the first screenshots were still queued behind it.

**Search engines and shared links.** `index.html` carries a canonical URL, the
Open Graph and Twitter card tags, and a block of JSON-LD describing the person,
the practice and the site. Both pages are one document served at two paths, so
the title, description, canonical and `og:url` all move together when the page
switches; that lives in `applyMeta` at the top of `script.js` and is the only
place any of it is written. `?p=portfolio` canonicalises to `/portfolio`, so the
two forms of the same page are never read as duplicates.

Two things are by hand, because there is no build step to stamp them: the
`lastmod` dates in `sitemap.xml`, and `og.jpg` itself. The card is a real
screenshot of the hero at 1200x630 with `?still=1` set and the header, the
section arrows and the hero buttons hidden. Re-shoot it if the hero changes, and
bump the `?v=` on the `og:image` tag when you do, or the networks will keep
serving the copy they cached.

The JSON-LD deliberately carries no email, no phone and no prices. The offers in
it match the Services section word for word: structured data that claims more
than the page shows is treated as spam rather than as a bonus.

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
