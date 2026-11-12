# tools/3d

Blender scripts (`*.py`) and scenes (`*.blend`) for the portfolio's 3D work. Nothing here is part of the site
build; the site only ever gets exported, compressed frames or clips.

## Rules

- **Renders never go in the repo.** Write them to `%LOCALAPPDATA%\raja-3d\renders\` (outside OneDrive, so
  large frame sequences don't sync). HDRIs and other downloads go to `%LOCALAPPDATA%\raja-3d\hdri\` etc.
- `*.blend1` backups and any `renders/` folder under `tools/` are git-ignored.
- No brand logos on devices and nothing that imitates another company's interface or hardware. Screens show
  only Raja's own product screenshots (from `_source/animation-assets/`, never committed), used exactly as
  captured: crops, rounded-corner masks and scrolling only; no edited text, numbers, names or colours, no
  added screens or states, no upscaling.
- Only CC0 assets (e.g. Poly Haven HDRIs and textures); note the asset name and source in the script.

## Running a script (headless, no MCP needed)

```sh
"C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b --factory-startup -P tools/3d/<script>.py -- [script options]
```

Everything after `--` goes to the script. `--factory-startup` keeps local preferences and add-ons out of the
result, so timings and renders are repeatable.

## Blender MCP (interactive work)

Claude Code can drive a running Blender through the official Blender Lab MCP server:

1. In Blender 5.1 or newer, install and enable the **MCP** add-on from Blender Lab
   (https://www.blender.org/lab/mcp-server/). It listens on `localhost:9876` while Blender is open.
2. Clone the server (`https://projects.blender.org/lab/blender_mcp.git`, a release tag) outside the repo and
   run `uv sync` in its `mcp/` folder. Behind HTTPS-scanning antivirus, add `--system-certs` to `uv`.
3. Register it for this project only:
   `claude mcp add --scope project blender -- uv --system-certs --directory "<clone>\mcp" run blender-mcp`,
   then approve it once (start `claude` in the repo, or list it under `enabledMcpjsonServers` in
   `.claude/settings.local.json`). Check with `claude mcp list`.

`.mcp.json` holds a machine-specific path, so it is git-ignored; each machine registers its own.

## The AsaanBill scroll scene (`asaanbill/`)

A 144-frame scene, scrubbed by scrolling on the homepage (`src/components/ScrollScene.astro`). The Python
scripts are the source of truth; `asaanbill.blend` is their output (texture paths relative, no local user
name, saved uncompressed so that is easy to check).

| Script | Does |
|---|---|
| `asaanbill/prepare_textures.py` | Screens and floating UI crops from the three portal screenshots → `%LOCALAPPDATA%\raja-3d\asaanbill\textures\`, `textures.json`, and a contact sheet in the render folder. Crops snap to the element's real edges and use its own corner radius. |
| `asaanbill/build_scene.py` | The whole scene from scratch: generic laptop and tablet at real scale, screens (Standard view transform, whites ~0.93), cover glass, floating cards, lights, camera, the 4-beat choreography. Everything placeable is in the configuration block at the top. Saves `asaanbill.blend`. |
| `asaanbill/render.py` | Renders frames (`--engine eevee` or `cycles`, `--frames 1-144`, `--out`). Resumable: existing frames are skipped. Logs seconds per frame and an estimate to `render.log`. |
| `asaanbill/checks.py` | Size of every UI element in the final 1440x1080 frame against its native pixels (limit 1.25x), card turns (limit 10 deg), stepper overlaps, and a colour check of a rendered frame against the screenshots (`-- --colour <png> --frame N`). |
| `encode_frames.py` | Composites the frames over the site's stage colour (`--color-bg`), writes the desktop and phone WebP sets, posters and `manifest.json` to `public/scenes/<scene>/`, within the budgets. |

Rebuild and re-render (from the repo root; `B` = the Blender executable):

```sh
python tools/3d/asaanbill/prepare_textures.py
"$B" -b --factory-startup -P tools/3d/asaanbill/build_scene.py
"$B" -b tools/3d/asaanbill/asaanbill.blend -P tools/3d/asaanbill/checks.py
"$B" -b tools/3d/asaanbill/asaanbill.blend -P tools/3d/asaanbill/render.py -- --engine eevee --frames 1-144 --out "%LOCALAPPDATA%\raja-3d\renders\asaanbill\frames-eevee"
python tools/3d/encode_frames.py asaanbill --frames-dir "%LOCALAPPDATA%\raja-3d\renders\asaanbill\frames-eevee" --engine eevee
```

EEVEE takes ~10 s a frame on this laptop (~25 min for 144); Cycles (96 adaptive samples, OpenImageDenoise,
CPU) ~220-250 s a frame (~9 h), so render it in the background. To redo part of a render, delete those frames
and run the same command again. Then build the site and check the scene at 390, 1280 and 1440 px.

## Adding the next scene (TapitCard, Ladenza)

1. Put the source material in `_source/animation-assets/<scene>/` and list it in that folder's README.
2. Copy `asaanbill/` to `tools/3d/<scene>/` and adapt `prepare_textures.py` (crops) and the configuration
   block of `build_scene.py` (devices, shots, beats). Keep beats aligned with the product's four "How it
   works" steps in `home.json`.
3. Build, run `checks.py` until nothing is over 1.25x, render, then run
   `python tools/3d/encode_frames.py <scene> --frames-dir <frames> --engine <eevee|cycles>`.
4. Add the product's id to `home.json → products.scrollScenes` and give its `products.items` entry a `scene`
   block (`alt`, `caption`, `skipLabel`). `ProductShowcase` then renders it with `ScrollScene` instead of the
   SVG stage; nothing else changes.
