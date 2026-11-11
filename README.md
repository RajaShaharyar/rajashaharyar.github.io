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
- `sitemap-index.xml` is generated on every build (`@astrojs/sitemap`); `/404`, `/contact/thanks/` and the
  redirects (see Site structure) are left out. `public/robots.txt` points to it.
- Analytics are off. To switch on a cookie-free option, set `site.json → analytics.provider`
  (`goatcounter`, `cloudflare` or `plausible`) and its `id`. GA4 is left out: it would need a cookie banner.

## Site structure

The structure follows the sitemap in `_source/Consultation Website.pdf`.

| Page | Sections (anchor) |
| ---- | ----------------- |
| Top bar | Home · Ventures ▾ · Work With Me · About ▾ · CV · Let's talk (`site.json → nav`, `cta`). About's eight items are sections of `/about/`. |
| `/` | Hero · `#proof` · `#credibility` · `#products` · `#playbook` · `#help` · `#recognition` · `#testimonials` · closing CTA |
| `/ventures/` | Cards in menu order (Other ventures last) · stage legend · `#yours-next` |
| `/ventures/dressup/`, `/ventures/sonicengine-ai/` | Role stories: header (role, dates, location) · `#product` · `#what-i-did` · optional blocks · `#next` · CTA |
| `/ventures/asaanbill/`, `/ventures/tapit/`, `/ventures/ladenza/` | Case studies (snapshot, problem, stages, approvals, journey… next) |
| `/ventures/other/` | HOMS Inc. (featured), Gameotivity, Mustahiq · "Yours next?" |
| `/work-with-me/` | `#services` · `#process` (steps, then How I work) · `#faq` · closing CTA |
| `/about/` | "On this page" row · `#intro` · `#career` · `#recognition` · `#education` · `#courses` · `#distinctions` · `#beyond-work` · `#speaking` |
| `/contact/` | What's this about? · Your details · Message · contact details |
| `/recognition/` and its four pages | Unchanged; not in the top bar. Linked from About → Recognition, the homepage and the footer (`site.json → recognitionMenu`). |
| `/cv/` | Unchanged. |

**Redirects** (`astro.config.mjs → redirects`; static meta-refresh pages, noindex, left out of the sitemap, each
pointing straight at the final address): `/ventures/consulting/` and `/ventures/earlier-roles/` → `/ventures/other/`;
`/about/education/` → `/about/#education`; `/about/beyond-work/` → `/about/#beyond-work`; `/about/skills/` →
`/cv/#skills`. `npm run check:links` fails if a redirect's page or anchor is missing or it points at another redirect.

**Reorder the homepage products:** edit `home.json → products.featured` (the sticky-stage blocks: AsaanBill,
TapitCard, Ladenza) and `products.alsoWorkedOn` (the compact cards: Sonic AI Engine, Dressup). Ids are
`site.json → ventures` ids; moving an id between the two lists also needs its scene redrawn at the other size
(featured scenes are 480×360, compact ones 320×220). The Ventures menu keeps its own order (`site.json → nav`).

**Same-page menu links** (About's items on `/about/`, "Yours next?" on `/ventures/`): the nav script closes the
dropdown or the mobile panel first, the browser then scrolls (smoothly unless reduced motion is on) to the
section, which lands below the sticky header (`[id] { scroll-margin-top }`), and focus moves to it.

**Add a testimonial:** add `{ "quote": "...", "name": "...", "role": "...", "company": "..." }` to
`site.json → testimonials`. The homepage Testimonials section (`#testimonials`) appears as soon as there is one.
Only real quotes, with the person's permission.

**Add a venture:** a new file in `src/content/ventures/`, an entry in `site.json → ventures` and a menu item in
`site.json → nav`. Use `kind: case-study` when there is a full story, `kind: role-story` when the facts are one
`cv.json → experience` entry (no stage badge, no metric), or add it to `other.mdx` (`kind: roles`).

## Where things live

```
src/
  content/
    site.json          name, title, contact, nav (top bar), recognitionMenu, headline stats, venture cards (menu
                       order), offers (home: true = on the homepage too), testimonials
    work-with-me.json  copy for /work-with-me (services heading, steps, how I work, FAQ, call to action)
    home.json          homepage copy, section by section (products: featured / alsoWorkedOn and each story's
                       steps and sources; carousel order: recognition.slides),
                       plus the /ventures heading and the shared "Yours next?" block
    about.json         copy for the one About page (sections, story, recognition, education, distinctions,
                       beyond work, speaking); points into cv.json by id for CV facts
    images.json        every published photo: size (prevents layout shift), alt text, caption
    recognition.json   the Recognition log: one item per win, award, programme, MOU, talk… (badge, title,
                       organiser, venue, date, prize, venture, photos; "shownOn" decides which pages list it)
    recognition-pages.json  copy for /recognition and its four sub-pages (counter labels, headings, topics)
    cv.json            all 14 CV sections: the one source for roles, degree, programmes, skills, languages
    ventures/*.mdx     one file per venture: a case study (kind: case-study) or a role story (kind:
                       role-story, built from one cv.json entry), both → layouts/VentureLayout; or Other
                       ventures (kind: roles → layouts/RolesLayout, cards from cv.json)
  content.config.ts    schemas: the build fails if recognition.json or a venture file is malformed
  lib/                 typed access to the data (site, cv, about, images, recognition) and date formatting
  styles/global.css    design tokens (colour, type, radius, layout): the one place to change the look
  layouts/Base.astro   SEO (title template, canonical, Open Graph, Person JSON-LD), font preloads, nav, footer
  components/          Nav, Footer, homepage sections (ProductShowcase + ProductScene + ProductSteps), Timeline, Gallery (photo
                       grid + lightbox), YoursNext
  pages/               one file per route (see Site structure)
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

## About page

- One page, eight sections, with an "On this page" row (`about.json → page.sections`).
- **Career timeline**: entries in `about.json → story.timeline.items`, oldest first. Dressup and Gameotivity
  join it automatically, in date order, once their start dates in `cv.json → experience` are filled in (`YYYY-MM`).
  "2024 in review" closes the section.
- **Recognition**: the /recognition counters, then up to 6 wins (Winner or Top 3) that have a photo, in the
  homepage carousel order, then links to the four Recognition pages.
- **Education** and **Courses** read the degree and programmes from `cv.json`; a programme's "what it covered" and
  certificate link appear only once they are filled in there. The closing line is flagged `draft: true`.
- **Distinctions**: `about.json → distinctions.recognitionIds`; the text comes from `cv.json → honours` or
  `leadership`, the photo from `recognition.json`.
- Every photo group is a `Gallery`: a lazy-loaded grid whose photos open in an accessible lightbox
  (Enter or click opens, ←/→ step, Tab stays inside, Escape closes, focus returns to the photo).

## Venture pages

Each venture is one file in `src/content/ventures/`: its frontmatter holds the whole case study (snapshot,
problem, the three stages, approvals spotlight, journey, glossary, limitations, who did what, results, lessons,
evidence ids, press, next), validated by the schema in `src/content.config.ts`. `src/layouts/VentureLayout.astro`
renders every case study the same way and leaves out any block with no data, so adding a limitation or a lesson
later is a data edit. Case-study facts live only there (the CV reads Tapit's pre-sales from `tapit.mdx`).
A file marked `status: draft` shows a stub until it is published.

Dressup and Sonic AI Engine are role stories (`kind: role-story`): the header and the "The product" and "What I
did" blocks come from their `cv.json → experience` entry. The problem, limitations, results, lessons, evidence
photos and product link render only once filled in; their `todo` lists say what is missing. Other ventures
(`other.mdx`, `kind: roles`) lists cv.json roles (`roles`) and other ventures (`otherVentures`, e.g. Mustahiq,
linking to About → Beyond work). Next links run Dressup → AsaanBill → Sonic AI Engine → TapitCard → Ladenza →
Other ventures.

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

The form at `/contact/` emails Raja through **Web3Forms** (free, no account). It is switched on:
`src/content/site.json` → `contact.form.provider` is `"web3forms"` and `web3formsKey` holds the access key
(Web3Forms keys are designed to sit in public page source). To change the key, paste the new one there, rebuild
and push. Setting `provider` to `""` switches the form back to opening the visitor's email app (mailto).

Messages arrive at the address the key belongs to, with Reply-To set to the sender's email. With JavaScript the
form sends in the page and shows a confirmation (or an error with email-app and WhatsApp fallbacks); without it,
the form posts normally and Web3Forms redirects to `/contact/thanks/`. Formspree also works: put the form ID in
`contact.form.formspreeId` and set `provider` to `"formspree"`.
Links can preselect a reason, e.g. `/contact/?reason=speaking` (`hiring`, `growth-help`, `speaking`, `other`).

## Motion

Motion is subtle, uses only opacity and transform (CLS stays 0) and switches off completely with
`prefers-reduced-motion: reduce`.

- **Scroll reveal** (`src/scripts/reveal.ts`, styles at the end of `global.css`): add `data-reveal` to an
  element, or `data-reveal-stagger` to a list so its items follow each other 70 ms apart (max 420 ms).
  Use `data-reveal-stagger="inner"` for grids whose 1px dividers are the list's background (proof bar,
  hard wins, counters): the items' contents fade instead of the items. Elements on screen at load never
  fade, and nothing is hidden without JavaScript or in print.
- **Hero**: the text fades and rises once on load (`.hero-intro`); the photo never fades.
- **Homepage products, "The work"** (`ProductShowcase`, `ProductScene`, `ProductSteps`): one short brand story
  per product, in 4 beats, with Raja's part in the accent colour.
  - *Data:* `home.json → products.items[]`: `steps` (text, `at` = beat start in ms, `mine` = Raja's part),
    `duration`, `myPart` (lines copied from cv.json or the venture MDX) and `_sources` (the research behind each
    scene; never rendered).
  - *Scenes* (`ProductScene.astro`): inline SVG in the colour tokens, no words, numbers or logos. The beat
    starts become `--b1`…`--b4` on the scene; every animated element has class `a`, an animation class (`fade`,
    `up`, `draw`, `pop`, `move`, …) and `--t: calc(var(--bN) + offset)` (plus `--d` for its duration). The
    element's default style is its final frame, so no-JavaScript and reduced-motion visitors see a complete
    illustration.
  - *Step list* (`ProductSteps.astro`): a real `<ol>`; each step has the same `--t`, so it lights up (accent
    tick, full-contrast text) when its beat starts. Raja's steps have an accent dot and "(my part)" for screen
    readers, with the key "Highlighted: my part".
  - *Playback:* the script only sets `data-armed` (paused on the first frame) and `data-playing` on a scene and
    its list together; a replay removes both, forces a reflow and sets both again. Wide screens: the block
    crossing the middle of the viewport drives a sticky stage (crossfade, then play; scrolling back replays).
    Phones and the compact cards: play once in view. Every scene has a Replay button (hidden with reduced
    motion). Transform, opacity and stroke-dashoffset only; each scene lasts at most 4.2 s.
- **Proof bar count-up** (`StatBar.astro`): the number part counts up once over 1.2 s when the bar scrolls
  into view. The HTML holds the final values and screen readers only hear those.
- **Hover and focus**: cards that are one big link get `.lift-card` (lift 2px, a soft shadow that fades in,
  the photo grows to at most 1.03 inside its frame; keyboard focus does the same plus the ring). Buttons
  change shade; arrow links nudge their arrow 2px.
- **Menus**: desktop dropdowns fade and slide 4px (160 ms, opening at once on keyboard focus); the mobile
  accordion animates its height (grid rows 0fr → 1fr).
- **Carousel**: slides glide over 300 ms; no autoplay with reduced motion.
- **My story timeline**: the rail draws down as it enters view (`data-reveal-draw`), items follow with their dots.
- **Reading progress**: a thin accent bar on the four venture pages (`ReadingProgress.astro`).
- **Page transitions**: a 200 ms cross-fade with CSS cross-document view transitions
  (`@view-transition`, end of `global.css`). There is no client-side router.
- **Lightbox** fades in and out over 150 ms; anchor links scroll smoothly; every element with an `id` has
  `scroll-margin-top`, so anchors land just below the header (venture blocks and `/cv` set their own).

## Performance

Sections below the fold use `content-visibility: auto` (`.defer-render`, and the venture blocks), so the
browser skips their layout and paint until they come near the screen. That roughly halves the first-load
work on the long pages. They always render for print, and any anchor jump (`:target`) renders the whole page
so it lands exactly. Note for tooling: a full-page screenshot only paints what is on screen, so scripts that
screenshot or audit whole pages first add `* { content-visibility: visible !important }` (as `check:a11y` does).

The fonts are preloaded. If they still arrive after the first paint (a slow first visit), text is first drawn in
"Inter Fallback" / "Bricolage Fallback" (top of `global.css`): Arial with `size-adjust` and ascent/descent
overrides measured against the site's own text, so the swap moves nothing (CLS stayed at 0.0005 or less
with the fonts delayed 1.2 s, against up to 0.15 before). Re-measure those values if the fonts or type scale change.

## Deployment

`.github/workflows/deploy.yml` builds with `withastro/action` and deploys with `actions/deploy-pages` on every push to `main` (or run it manually from the Actions tab). Pages is set to build from GitHub Actions.
