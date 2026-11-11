# tools/3d

Blender scripts (`*.py`) and scenes (`*.blend`) for the portfolio's 3D work. Nothing here is part of the site
build; the site only ever gets exported, compressed frames or clips.

## Rules

- **Renders never go in the repo.** Write them to `%LOCALAPPDATA%\raja-3d\renders\` (outside OneDrive, so
  large frame sequences don't sync). HDRIs and other downloads go to `%LOCALAPPDATA%\raja-3d\hdri\` etc.
- `*.blend1` backups and any `renders/` folder under `tools/` are git-ignored.
- No brand logos, real screenshots or anything that imitates a real company's interface. Screens use plain
  placeholder images; real screens are added later and only from Raja's own material.
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
