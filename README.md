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
| `npm run og`      | Build and render the 1200×630 share images into `public/og/` |
| `npm run check:links` | After a build: internal links, anchors, alt text, JSON-LD, then external links |
| `npm run check:a11y`  | After a build: axe on every page at 390px and 1280px (zero violations) |
| `npx cspell "src/content/**/*"` | Spell-check the content (en-GB, project words in `cspell.json`) |

## Launch checklist (when content changes)

- A page title or description changed: rerun `npm run og` and commit `public/og/`.
- Before pushing a bigger change: `npm run check`, `npm run build`, `npm run check:links`, `npm run check:a11y`.
- `sitemap-index.xml` is generated on every build (`@astrojs/sitemap`); `/404`, `/contact/thanks/` and the
  redirects (see Site structure) are left out. `public/robots.txt` points to it.
- Analytics are off. To switch on a cookie-free option, set `site.json → analytics.provider`
  (`goatcounter`, `cloudflare` or `plausible`) and its `id`. GA4 is left out: it would need a cookie banner.

## Site structure

The structure follows the sitemap in `_source/Consultation Website.pdf`.

| Page | Sections (anchor) |
| ---- | ----------------- |
| Top bar | Home · Ventures ▾ · Work With Me · About ▾ · Let's talk (`site.json → nav`, `cta`). About ▾ = My story, Education, Beyond work and the CV (the only CV link outside `/cv/`). |
| `/` | Hero · `#proof` · `#credibility` · `#products` · `#playbook` · `#help` · `#recognition` · `#testimonials` · closing CTA |
| `/ventures/` | Cards in menu order (Other ventures last) · stage legend · `#yours-next` |
| `/ventures/dressup/`, `/ventures/sonicengine-ai/` | Role stories: header (role, dates, location) · `#product` · `#what-i-did` · optional blocks · `#next` · CTA |
| `/ventures/asaanbill/`, `/ventures/tapit/`, `/ventures/ladenza/` | Case studies (snapshot, problem, stages, approvals, journey… next) |
| `/ventures/other/` | HOMS Inc. (featured), Gameotivity, Mustahiq · "Yours next?" |
| `/work-with-me/` | `#services` · `#process` (steps, then How I work) · `#faq` · closing CTA |
| `/about/` (My story) | Tabs · the story (`#intro`) · `#career` · `#recognition` · `#along-the-way` (the 2024 photos) · "Let's talk" |
| `/about/education/` | Tabs · `#degree` · `#courses` · `#distinctions` · "Let's talk" |
| `/about/beyond-work/` | Tabs · `#mustahiq` · `#k2` · `#speaking` · "Invite me to speak" |
| `/contact/` | What's this about? · Your details · Message · contact details |
| `/recognition/` and its four pages | Unchanged; not in the top bar. Linked from About → Recognition, the homepage and the footer (`site.json → recognitionMenu`). |
| `/cv/` | Unchanged. |

**Redirects** (`astro.config.mjs → redirects`; static meta-refresh pages, noindex, left out of the sitemap, each
pointing straight at the final address): `/ventures/consulting/` and `/ventures/earlier-roles/` → `/ventures/other/`;
`/about/skills/` → `/cv/#skills`. (`/about/education/` and `/about/beyond-work/` are real pages again; a link to an
old one-page anchor such as `/about/#speaking` is sent on to its new page by a small script on `/about/`.) `npm run check:links` fails if a redirect's page or anchor is missing or it points at another redirect.

**Reorder the homepage products:** edit `home.json → products.cards` (the deck, one card per venture; ids are
`site.json → ventures` ids, each with a `products.items` entry). The Ventures menu keeps its own order
(`site.json → nav`).

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
    home.json          homepage copy, section by section (products: the deck's cards, each card's label,
                       headline, colour, steps and sources
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
  components/          Nav, Footer, homepage sections (VentureDeck + AsaanBillBoard + TapitCardBoard + ProductScene,
                       PlaybookStages),
                       Timeline, Gallery (photo grid + lightbox), YoursNext
  scripts/             reveal, deck (the venture card deck), asaanbill-board (the AsaanBill card's timeline)
  pages/               one file per route (see Site structure)
public/images/         ventures/, recognition/, speaking/, about/, education/
public/fonts/          Plus Jakarta Sans (Latin, 500-800) for the AsaanBill card; Jost (Latin, 400 and 700) for the
                       TapitCard card; both OFL, licences alongside
public/media/tapitcard/  the TapitCard card artwork, front and back, WebP at 1400w and 700w (metadata stripped)
tools/3d/              Blender scripts for the 3D scenes and the frame encoder (see tools/3d/README.md)
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
resizes to max 1600px wide (never upscaling), writes WebP, strips all metadata (EXIF, GPS, ICC, XMP) and verifies
it. Per-entry options: `native` keeps a UI screenshot at its own width (the AsaanBill portal screens), `quality`
keeps text crisp (88-90 for screenshots and logos), `trim` crops a logo's empty transparent margin.
It also writes 480 and 960 px copies (`name-480.webp`, `name-960.webp`) that `Media` serves through
`srcset`/`sizes`; the plain file name stays the largest version.
iPhone HEIC files are decoded with `heic-convert` first (sharp can't read HEVC), and a PDF page source
(`{ pdf, page }`) extracts that page's one embedded JPEG byte-for-byte with `pdf-lib`; that's how the
"Along the way" photos come out of *2024 Unwrapped.pdf* without the slide's text and stickers. An entry in
`images.json` can also point at files outside `public/images` with `urls` (by width): the TapitCard card faces
on its venture page reuse the deck's `public/media/tapitcard/` files that way.
A typo in an image path fails the build. Everything except the hero image is lazy-loaded.

## About pages

- Three pages (Phase 17), each with one H1, its own title, description, share image and closing call to action
  (`about.json → page`): **My story** (`/about/`), **Education** (`/about/education/`) and **Beyond work**
  (`/about/beyond-work/`). Tabs link the three; the About dropdown adds the CV.
- **Career timeline**: entries in `about.json → story.timeline.items`, oldest first. Dressup and Gameotivity
  join it automatically, in date order, once their start dates in `cv.json → experience` are filled in (`YYYY-MM`).
- **Along the way** (My story): the 2024 photos in date order (`about.json → story.alongTheWay`), with the lightbox.
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

Since Phase 17 each venture page's header shows the venture's **live deck card** (`DeckCard.astro`, the same
animation as on the homepage, with its own pause button; `src/scripts/venture-card.ts` plays it, sharing
`src/scripts/card-player.ts` with the deck): on the right from 1024 px, below the header text on narrower screens.
It is the page's only autoplaying animation; reduced motion and no JavaScript show its final frame. A `logo`
in the frontmatter adds a logo lockup under the H1 (AsaanBill · by Evamp & Saanga; TapitCard), and `pictures`
adds an **In pictures** gallery after the first block (AsaanBill: the three portal screens; TapitCard: the
card's two faces, the website's light hero and How it works, the K2prenuer premiere). A picture that is
already in Evidence is never repeated. Ladenza, Sonic AI Engine and Dressup have no photos yet: their live
card is the page's visual.

Dressup and Sonic AI Engine are role stories (`kind: role-story`): the header and the "The product" and "What I
did" blocks come from their `cv.json → experience` entry. The problem, limitations, results, lessons, evidence
photos and product link render only once filled in; their `todo` lists say what is missing. Other ventures
(`other.mdx`, `kind: roles`) lists cv.json roles (`roles`) and other ventures (`otherVentures`, e.g. Mustahiq,
linking to About → Beyond work, with its two photos from `cv.json → otherVentures[].images`). Next links run Dressup → AsaanBill → Sonic AI Engine → TapitCard → Ladenza →
Other ventures.

## Recognition pages

`/recognition` and its four sub-pages are built from `recognition.json` only. Counters are computed from each
item's `badge` (Winner, Top 3, Award, Programme, MOU, Talk…), so adding an item updates them; `order` sets the
card order within a section and `highlight` puts an item on the overview. Unknown fields stay `TODO: …` and are
hidden. Every photo opens in the same accessible lightbox as the About pages.

## CV page and PDF

`/cv` is built from `src/content/cv.json` (key numbers from `site.json → stats`, contact details from
`site.json → contact`). Consultation first: the CV page is linked only from the About dropdown, never from the
top bar, the hero or the footer.

The PDF is **Raja's own 2-page Europass CV**, not generated from cv.json: `public/Raja-Shaharyar-PM.pdf`, made from
`_source/Raja Shaharyar PM.pdf` with date of birth, nationality, gender and the home address (with its map-pin
icon) removed by true redaction (PyMuPDF redaction annotations, applied, so the text is gone from the file, not
covered), author "Raja Shaharyar Ali", title "Raja Shaharyar PM", no XMP. Everything else is his original wording
and layout. Its one download link is the "Download PDF" button on `/cv/`, saved as `Raja Shaharyar PM.pdf`
(`site.json → cv`). To replace it, redact the new original the same way, check with a text extraction that the
four details are gone, and keep the file name.

## Contact form

The form at `/contact/` emails Raja through **Web3Forms** (free, no account). It is switched on:
`src/content/site.json` → `contact.form.provider` is `"web3forms"` and `web3formsKey` holds the access key
(Web3Forms keys are designed to sit in public page source). To change the key, paste the new one there, rebuild
and push. Setting `provider` to `""` switches the form back to opening the visitor's email app (mailto).

Messages arrive at the address the key belongs to, with Reply-To set to the sender's email. With JavaScript the
form sends in the page and shows a confirmation (or an error with email-app and WhatsApp fallbacks); without it,
the form posts normally and Web3Forms redirects to `/contact/thanks/`. Formspree also works: put the form ID in
`contact.form.formspreeId` and set `provider` to `"formspree"`.
Links can preselect a reason, e.g. `/contact/?reason=speaking` (`growth-help`, `speaking`, `other`; the old
`hiring` preselects Other). The reasons and their hints are in `src/content/contact.json`.

## Colour and bands

Near-black with warm off-white text, and two colours with fixed roles (tokens and computed contrast ratios in
`src/styles/global.css`):

- **Lime** (`accent`) = action and proof: primary buttons, key numbers, the current or active state (nav, the
  deck rail, the reached stage, the timeline's "current" marker, the growth line).
- **Violet** (`accent-2`, `accent-2-soft`, `accent-2-strong` for borders and glows, `accent-2-deep` for bands) =
  identity and atmosphere: eyebrows, taglines, tags and badges, link underlines and hover states, highlights,
  gradients, glows and section bands. `::selection` is violet with ink text.
- Text on a lime or violet fill uses the ink tokens (`accent-ink`, `accent-ink-muted`, `accent-2-ink`,
  `accent-2-ink-muted`, all at least 4.5:1 on their fills). Buttons on a band are near-black with lime text
  (`.btn-dark`). Focus rings are lime on dark and near-black on fills: a band sets `--focus-ring`, and a dark
  card inside a band (`.on-dark`) sets it back.
- **Bands** (`.band` + `.band-violet`, `.band-lime`, `.band-deep`, `.band-brand`, or `.band-fill` with
  `--band-bg`/`--ink`/`--ink-muted`): full-bleed sections. Never two colour blocks next to each other.
  Homepage: hero (near-black, drifting aurora and grain) · proof (violet, ink numbers) · credibility
  (near-black, violet separators) · the work (near-black, a soft violet glow behind the deck) · playbook (deep
  violet; nodes violet until reached) · help (lime, near-black cards with lime buttons) · recognition
  (near-black) · closing CTA (the brand gradient, violet to lime, display-xl ink) · footer (near-black, a
  lime→violet hairline, the name large in outline).
- **Inner pages**: every page header has a violet-led aurora with grain (`Aurora.astro`; static there, drifting
  only in the hero); a venture page's header is a band in that venture's deck colour with ink text and its live
  card. Work With Me: Services on violet, the process on near-black with violet step numbers, the FAQ, the
  gradient CTA. About: a violet timeline with a lime "current" marker, Recognition on deep violet, Along the way
  on near-black. Recognition pages: violet badges, counters on deep violet. Let's talk: aurora, the selected
  reason violet with ink, the submit button lime.
- **Signature details**: cards marked `data-spotlight` (service, venture, recognition, stage) get a lime→violet
  gradient border on hover and keyboard focus, and on fine pointers a soft violet glow that follows the pointer
  (`src/scripts/ambient.ts`, transform only, off with reduced motion). Headings use `text-wrap: balance`,
  paragraphs `text-wrap: pretty`.
- No background images: gradients are CSS, the grain is one small inline SVG (`feTurbulence`).

## Motion

Motion is subtle, uses only opacity and transform (CLS stays 0) and switches off completely with
`prefers-reduced-motion: reduce`.

- **Scroll reveal** (`src/scripts/reveal.ts`, styles at the end of `global.css`): add `data-reveal` to an
  element, or `data-reveal-stagger` to a list so its items follow each other 70 ms apart (max 420 ms).
  Use `data-reveal-stagger="inner"` for grids whose 1px dividers are the list's background (proof bar,
  hard wins, counters): the items' contents fade instead of the items. Elements on screen at load never
  fade, and nothing is hidden without JavaScript or in print.
- **Hero**: the text fades and rises once on load (`.hero-intro`); the photo never fades. The last word of the
  headline rotates once ("traction." → "businesses." → "revenue.", `src/scripts/hero-word.ts`), ending within 5 s
  and replaying when the hero comes back into view (at most every 10 s). The aurora drifts on 42-56 s cycles
  (transform only), paused off-screen and in a hidden tab, static with reduced motion.
- **Homepage products, "The work"** (`VentureDeck.astro`, `src/scripts/deck.ts`): a pinned deck, one card per
  venture (`home.json → products.cards`), Paymo-style.
  - *Wide screens* (1024 px and up, 600 px tall): the left column holds the heading, a progress rail (one line
    per card; the active one is longer, with the venture's name; each line is a button that scrolls to its
    card) and the active venture's text, kept minimal (Phase 17; the details live on the venture pages): the
    name (an H3 at display-lg, the largest text on the left), the tagline in violet (`products.items[].headline`,
    a draft), the one line (muted, at most two lines), the metric if there is one (a lime number) and "Read the
    story →" as a secondary button. The right column holds the deck: a square card in
    the venture's colour with a faint watermark label, a dark inner panel and one pause/play button (a
    two-tone focus ring, near-black inside and off-white outside, so it shows on every card colour).
  - *Card colours:* palette tokens, named in `home.json → products.items[].color` (so a token change updates
    the cards): AsaanBill `accent` (lime), TapitCard `accent-2` (violet), Ladenza `fg` (warm off-white),
    Sonic AI Engine `accent-strong` (light lime), Dressup `accent-2-soft` (light violet). Two hues and one warm
    neutral, alternating, so neighbouring cards in the stack always differ. The watermark is the card colour
    80% of the way to `#0b0c0e`.
  - *Edge fade:* every inner panel's content (`.deck-view`) fades out over 20-26 px on all four sides, so
    pieces around a focus area fade instead of being cut mid-word; every rest keeps its focus inside the
    unfaded area.
  - *Switching:* each card gets 70svh of scroll; active = floor(progress × N). The new card rises over the
    stack (650 ms); earlier cards peek out underneath, rotated −4° / +5° and darkened; the text crossfades.
    Scrolling up reverses it. It is time-based, never scrubbed.
  - *Narrow screens:* at least 640 px tall, the heading, the active text (the same minimal set) and the card
    (the largest square that fits above the "Let's talk" dock) pin.
    Shorter: a plain list, each card playing while in view.
  - *Autoplay:* only the active card runs, from beat 1 when it becomes active, looping after a 1.5 s hold;
    paused off-screen, in a hidden tab or by the button. Inactive cards show their first frame.
  - *Accessibility:* every venture's text stays in the DOM and the accessibility tree (inactive ones are only
    visually hidden; focusing a link in one brings its card forward). Cards are aria-hidden; the watermark is
    drawn from `data-label`. "Skip the ventures" jumps to the playbook. Reduced motion and no JavaScript get a
    plain list of cards in their final state.
- **The AsaanBill card** (`AsaanBillBoard.astro`, `src/scripts/asaanbill-board.ts`): AsaanBill's real portal UI
  rebuilt as live HTML/CSS from Raja's AsaanBill screenshots (kept in `_source/`, never committed): same wording,
  values, colours and radii; Inter for text, Plus Jakarta Sans for headings and figures. Every value appears in those
  screenshots; the story follows one real Reports row (Maintenance Charges – Oct, Ayesha Khan, Rs 166,800).
  - *Board and camera:* the pieces (collection tiles, invoice with How to pay, the Reports row, the stepper, the
    Disbursement card, the donut) sit on one board in screenshot pixels; the panel is a camera that pans and
    zooms it to one readable focus area per beat (`RESTS`, with phone values). Scales are set by legibility: at
    rest no text is under 13 px on desktop (11 px on phones) and the beat's key number is 16 px or more.
    `will-change` is only on during a move, so the text re-rasterises sharp at rest.
  - *Timeline (14.7 s):* PSID selected, the invoice rises in and fills in, the amount counts up (beat 1); the
    PSID resolves group by group (2); Unpaid → Pending → Settled and the Reports row slides in (3); the
    stepper's active pill moves along, Disbursement, the donut draws to 45% (4); hold, then a 400 ms dip back
    to the start. Only states the screenshots show; no toasts, cursors or invented screens.
  - The markup is the final state (no JavaScript and reduced motion show it); the font is only applied, and so
    only downloaded, once the deck is near.
- **The TapitCard card** (`TapitCardBoard.astro`, `src/scripts/tapitcard-board.ts`): the real card artwork (from
  Raja's files in `_source/`, never committed; exported to `public/media/tapitcard/`) as a physical card in CSS
  3D (perspective 1200 px, a 2 px edge, a contact shadow, a sheen that sweeps as it tilts or flips; tilts of
  18° or less; a flip is one 180° turn over 900 ms), and the four "How it works" feature cards from
  thetapitcard.com rebuilt in HTML/CSS with their published wording and line breaks, plus the "Start
  NETWORKING!" chip and a caption chip in the site's words. Century Gothic on the site; Jost here.
  - *Timeline (about 14 s, then a hold to 15 s and a 400 ms crossfade):* the front rises in at an angle with a
    sheen, Customize Design slides in (1); Add Social Links and Business Hours come in and tick, Unlimited
    Changes peeks in (2); back to the card, it flips, zoom to the QR, a scan frame closes in, NFC waves, the
    caption chip (3); pull back, flip to the front, a fan of five cards, Start NETWORKING! (4).
  - *Camera:* the same code as AsaanBill's (`src/scripts/board-camera.ts`). At rest rebuilt text is at least
    13 px on desktop (11 px on phones), and the card's printed logo and URL at least 11 px (10 px) at the beats
    that focus on them.
  - *Loading:* the images only when the deck is within one viewport, and never on first paint (only after the
    visitor scrolls, or once the deck is on screen); 700w when the panel is at most 800 device px wide, else
    1400w. The font only once the deck is near.
  - *Reduced motion and no JavaScript:* a static overview: the card front, the four feature cards and both chips.
- **The other cards** reuse their SVG scenes (`ProductScene.astro`; also on `/ventures` cards): inline SVG in the
  colour tokens, no words, numbers or logos. Beat starts (`home.json → products.items[].steps[].at`) become
  `--b1`…`--b4`; every animated element has class `a`, an animation class and `--t: calc(var(--bN) + offset)`.
  The element's default style is its final frame. The deck sets `data-armed` (paused on the first frame) and
  `data-playing`; a restart removes both, forces a reflow and sets both again. Placeholders until each
  venture's real-material phase.
- **"How I grow products", a growth path** (`PlaybookStages.astro`, `src/scripts/playbook.ts`): no boxed block;
  the three stage cards appear one by one along a rising line.
  - *From 1024 px:* a line rises from the "Idea" node (bottom left) to the top right, ending in an arrowhead;
    the cards sit along it like rising steps (offsets 160, 80 and 0 px), each card's top-left corner on a
    10 px node. Columns are percentages of the width and the SVG is stretched to the width (y in px), so the
    line meets the corners at every width.
  - *Narrower:* a vertical timeline: the line runs down a left rail, a node at the top of each card.
  - *Scroll (no pinning, reversible):* p = clamp((0.85 × viewport height − section top) / (0.9 × section
    height)). The line draws in four segments between the node thresholds (0.08 Idea, 0.30, 0.55, 0.80, then
    the arrowhead), so it reaches each node as it lights; a card enters (500 ms, then its contents 70 ms apart)
    when its node lights and leaves (250 ms) 0.04 below its threshold. Hover or focus lifts a card 2 px and
    makes its node glow. Focus on a link in a hidden card reveals it at once.
  - The cards stay an ordered list, always in the DOM and the accessibility tree (hidden = opacity and
    transform only). Reduced motion and no JavaScript: the finished path, every card visible.
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
