# Raja Shaharyar Ali: portfolio

Proof-led portfolio and online CV, live at **https://rajashaharyar.github.io**.

Built with Astro 7, Tailwind CSS 4 and MDX. The output is fully static, and every push to `main` deploys to GitHub Pages.

## Commands

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm install`     | Install dependencies (Node 22.23.4+; CI uses 24) |
| `npm run dev`     | Local dev server at `http://localhost:4321`   |
| `npm run build`   | Build the static site into `dist/`            |
| `npm run preview` | Serve the built site locally                  |
| `npm run check`   | Strict TypeScript and Astro diagnostics       |
| `npm run images`  | Convert listed photos from `_source/` into `public/images/` (see below) |
| `npm run icons`   | Make `apple-touch-icon.png` and `favicon.ico` from `public/favicon.svg` |
| `npm run cv:pdf`  | Build and print `/cv` to `public/cv.pdf` (max 2 pages); commit the PDF |
| `npm run og`      | Build and render the 1200×630 share images into `public/og/` |
| `npm run check:links` | After a build: internal links, anchors, alt text, JSON-LD, then external links |
| `npm run check:a11y`  | After a build: axe on every page at 390px and 1280px (zero violations) |
| `npx cspell "src/content/**/*"` | Spell-check the content (en-GB, project words in `cspell.json`) |

## Launch checklist (when content changes)

- A page title or description changed: rerun `npm run og` and commit `public/og/`.
- `cv.json` (or the stats/contact details) changed: rerun `npm run cv:pdf` and commit `public/cv.pdf`.
- Before pushing a bigger change: `npm run check`, `npm run build`, `npm run check:links`, `npm run check:a11y`.
- `sitemap-index.xml` is generated on every build (`@astrojs/sitemap`); `/404`, `/contact/thanks/` and the old
  `/ventures/earlier-roles` redirect are left out. `public/robots.txt` points to it.
- Analytics are off. To switch on a cookie-free option, set `site.json → analytics.provider`
  (`goatcounter`, `cloudflare` or `plausible`) and its `id`. GA4 is left out: it would need a cookie banner.

## Where things live

```
src/
  content/
    site.json          name, title, contact, nav, headline stats, venture cards, offers (home: true = on the
                       homepage too), testimonials
    work-with-me.json  copy for /work-with-me (steps, engagement models, FAQ, call to action)
    home.json          homepage copy, section by section (carousel order: recognition.slides)
    about.json         copy for the four About pages; points into cv.json by id for CV facts
    images.json        every published photo: size (prevents layout shift), alt text, caption
    recognition.json   the Recognition log: one item per win, award, programme, MOU, talk… (badge, title,
                       organiser, venue, date, prize, venture, photos; "shownOn" decides which pages list it)
    recognition-pages.json  copy for /recognition and its four sub-pages (counter labels, headings, topics)
    cv.json            all 14 CV sections: the one source for roles, degree, programmes, skills, languages
    ventures/*.mdx     one file per venture: a case study (kind: case-study → layouts/VentureLayout) or the
                       Consulting & product roles page (kind: roles → layouts/RolesLayout, cards from cv.json)
  content.config.ts    schemas: the build fails if recognition.json or a venture file is malformed
  lib/                 typed access to the data (site, cv, about, images, recognition) and date formatting
  styles/global.css    design tokens (colour, type, radius, layout): the one place to change the look
  layouts/Base.astro   SEO (title template, canonical, Open Graph, Person JSON-LD), font preloads, nav, footer
  components/          Nav, Footer, homepage sections, AboutHeader, Timeline, Gallery (photo grid + lightbox)
  pages/               one file per route in the blueprint's URL table
public/images/         ventures/, recognition/, speaking/, about/, education/
```

## Content rules

- **Never invent numbers, names or dates.** Missing content is a string starting with `TODO:`. It stays in the data
  and the field is **hidden** on the live site: no "TODO" text is ever published (`isTodo()` / `filled()` in
  `src/lib/site.ts`). Blocks and fields with no data are left out entirely: no empty headings or placeholders.
- `toConfirm` fields list facts to settle before a page relies on them. Raja's answers of 6 Nov 2026 are applied.
- Contact details live only in `site.json`; the CV and footer read them from there.
- No date of birth, gender, nationality or home address anywhere in the site or the CV PDF.

## Images

Photos are never copied by hand. Add the original file name and its clean output path to the list in
`scripts/images.mjs`, run `npm run images`, then fill in `alt` and `caption` for the new entry in
`src/content/images.json`. The script finds the file by exact name under `_source/`, applies EXIF rotation,
resizes to max 1600px wide, writes WebP, strips all metadata (EXIF, GPS, ICC, XMP) and verifies it.
It also writes 480 and 960 px copies (`name-480.webp`, `name-960.webp`) that `Media` serves through
`srcset`/`sizes`; the plain file name stays the largest version.
iPhone HEIC files are decoded with `heic-convert` first (sharp can't read HEVC), and a PDF page source
(`{ pdf, page }`) extracts that page's one embedded JPEG byte-for-byte with `pdf-lib`; that's how the
"2024 in review" photos come out of *2024 Unwrapped.pdf* without the slide's text and stickers.
A typo in an image path fails the build. Everything except the hero image is lazy-loaded.

## About pages

- **My story** timeline: entries in `about.json → story.timeline.items`, oldest first. Dressup and Gameotivity
  join it automatically, in date order, once their start dates in `cv.json → experience` are filled in (`YYYY-MM`).
- **Education** reads the degree and programmes from `cv.json`; a programme's "what it covered" and certificate
  link appear only once they are filled in there. The closing line is flagged `draft: true` for Raja to revise.
- Every photo group is a `Gallery`: a lazy-loaded grid whose photos open in an accessible lightbox
  (Enter or click opens, ←/→ step, Tab stays inside, Escape closes, focus returns to the photo).

## Venture case studies

Each venture is one file in `src/content/ventures/`: its frontmatter holds the whole case study (snapshot,
problem, the three stages, approvals spotlight, journey, glossary, limitations, who did what, results, lessons,
evidence ids, press, next), validated by the schema in `src/content.config.ts`. `src/layouts/VentureLayout.astro`
renders every case study the same way and leaves out any block with no data, so adding a limitation or a lesson
later is a data edit. Case-study facts live only there (the CV reads Tapit's pre-sales from `tapit.mdx`).
A file marked `status: draft` shows a stub until it is published.

## Recognition pages

`/recognition` and its four sub-pages are built from `recognition.json` only. Counters are computed from each
item's `badge` (Winner, Top 3, Award, Programme, MOU, Talk…), so adding an item updates them; `order` sets the
card order within a section and `highlight` puts an item on the overview. Unknown fields stay `TODO: …` and are
hidden. Every photo opens in the same accessible lightbox as the About pages.

## CV page and PDF

`/cv` is built from `src/content/cv.json` (key numbers from `site.json → stats`, contact details from
`site.json → contact`). Its print stylesheet is the PDF layout.

**After editing cv.json (or the stats or contact details), run `npm run cv:pdf` and commit `public/cv.pdf`.**
The script builds the site, serves it locally, prints `/cv/` to A4 in Playwright's Chromium and saves
`public/cv.pdf`. It fails if the PDF is longer than 2 pages, sets the PDF title and author, and reads the
text back to check it is selectable, in section order and free of personal details.
First time on a new machine: `npx playwright install chromium`.

The "Download CV" links (homepage hero, footer, `/cv` header) appear whenever `public/cv.pdf` exists and
save as `Raja-Shaharyar-Ali-CV.pdf` (`site.json → cv.downloadName`). The PDF never holds a photo, date of
birth, gender, nationality or home address.

## Contact form

The form at `/contact/` emails Raja through **Web3Forms** (free, no account) once its access key is set:

1. Get a key at web3forms.com for rajasali2002@gmail.com.
2. Paste it into `src/content/site.json` → `contact.form.web3formsKey` and set `contact.form.provider` to `"web3forms"`.
3. Rebuild and push.

Messages arrive at the address the key belongs to, with Reply-To set to the sender's email. With JavaScript the
form sends in the page and shows a confirmation (or an error with email-app and WhatsApp fallbacks); without it,
the form posts normally and Web3Forms redirects to `/contact/thanks/`. Formspree also works: put the form ID in
`contact.form.formspreeId` and set `provider` to `"formspree"`. Until a provider is set, the form opens the
visitor's email app with the message ready (mailto).
Links can preselect a reason, e.g. `/contact/?reason=speaking` (`hiring`, `growth-help`, `speaking`, `other`).

## Deployment

`.github/workflows/deploy.yml` builds with `withastro/action` and deploys with `actions/deploy-pages` on every push to `main` (or run it manually from the Actions tab). Pages is set to build from GitHub Actions.
