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

## Where things live

```
src/
  content/
    site.json          name, title, contact details, nav, headline stats
    recognition.json   the Recognition log (one object per row; "shownOn" decides which pages list it)
    cv.json            all 14 CV sections (feeds /cv, the PDF, Education, Skills & tools)
    ventures/*.mdx     one file per venture, rendered by pages/ventures/[slug].astro
  content.config.ts    schemas: the build fails if recognition.json or a venture file is malformed
  styles/global.css    design tokens (colour, type, radius, layout): the one place to change the look
  layouts/Base.astro   SEO (title template, canonical, Open Graph, Person JSON-LD), nav, footer
  components/          Nav, Footer, StubPage, Todo
  pages/               one file per route in the blueprint's URL table
public/images/         ventures/, recognition/, speaking/, about/, education/
```

## Content rules

- **Never invent numbers, names or dates.** Missing content is a string starting with `TODO:` and renders as a visible dashed placeholder.
- `toConfirm` fields list facts to settle before a page relies on them.
- Contact details live only in `site.json`; the CV and footer read them from there.
- No date of birth, gender, nationality or home address anywhere in the site or the CV PDF.

## Contact form

The form at `/contact/` uses a mailto fallback until a Formspree form ID is set:
open `src/content/site.json` and fill in `contact.form.formspreeId` (the part after `formspree.io/f/`), then push.
Links can preselect a reason, e.g. `/contact/?reason=speaking` (`hiring`, `growth-help`, `speaking`, `other`).

## Deployment

`.github/workflows/deploy.yml` builds with `withastro/action` and deploys with `actions/deploy-pages` on every push to `main` (or run it manually from the Actions tab). Pages is set to build from GitHub Actions.
