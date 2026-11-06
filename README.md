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

## Where things live

```
src/
  content/
    site.json          name, title, contact, nav, headline stats, venture cards (+ venture facts), offers, testimonials
    home.json          homepage copy, section by section (carousel order: recognition.slides)
    about.json         copy for the four About pages; points into cv.json by id for CV facts
    images.json        every published photo: size (prevents layout shift), alt text, caption
    recognition.json   the Recognition log (one object per row; "shownOn" decides which pages list it)
    cv.json            all 14 CV sections: the one source for roles, degree, programmes, skills, languages
    ventures/*.mdx     one file per venture, rendered by pages/ventures/[slug].astro
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
  `src/lib/site.ts`; the `<Todo>` component renders only in `npm run dev`).
- `toConfirm` fields list facts to settle before a page relies on them. Raja's answers of 6 Nov 2026 are applied.
- Contact details live only in `site.json`; the CV and footer read them from there.
- No date of birth, gender, nationality or home address anywhere in the site or the CV PDF.

## Images

Photos are never copied by hand. Add the original file name and its clean output path to the list in
`scripts/images.mjs`, run `npm run images`, then fill in `alt` and `caption` for the new entry in
`src/content/images.json`. The script finds the file by exact name under `_source/`, applies EXIF rotation,
resizes to max 1600px wide, writes WebP, strips all metadata (EXIF, GPS, ICC, XMP) and verifies it.
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

## CV download

Drop the sanitised PDF at `public/cv.pdf` (no date of birth, gender or home address). The homepage
"Download CV" button and the footer link appear automatically on the next build.

## Contact form

The form at `/contact/` uses a mailto fallback until a Formspree form ID is set:
open `src/content/site.json` and fill in `contact.form.formspreeId` (the part after `formspree.io/f/`), then push.
Links can preselect a reason, e.g. `/contact/?reason=speaking` (`hiring`, `growth-help`, `speaking`, `other`).

## Deployment

`.github/workflows/deploy.yml` builds with `withastro/action` and deploys with `actions/deploy-pages` on every push to `main` (or run it manually from the Actions tab). Pages is set to build from GitHub Actions.
