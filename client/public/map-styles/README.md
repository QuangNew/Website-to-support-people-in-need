# Bundled OpenStreetMap Shortbread presentation assets

The production frontend serves these style and sprite files from its own
origin. This avoids relying on the origin allow-list used by the OpenStreetMap
style server. At runtime, the app points the Shortbread vector source at
`https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}` and adds the required ESA
WorldCover attribution alongside OpenStreetMap. This keeps the existing
Vietnam boundary and label filters while avoiding dependency on a single
OSM tile hostname, which some networks block.

Set the build variable `VITE_BASEMAP_TILE_URL` to use another compatible
Shortbread tile template. GitHub's frontend deployment passes the repository
variable with the same name to Vite. For a custom provider, retain its required
attribution in these bundled styles. The public VersaTiles service has no uptime
guarantee; a self-hosted Shortbread endpoint can use the same setting.

The runtime presentation uses blue water, green vegetation and distinct road
colors in both themes. Country labels follow the UI language (Vietnamese,
English or Japanese). Since these Shortbread tiles do not include Vietnamese
or Japanese names, country translations use the browser's `Intl.DisplayNames`
with English-name aliases; other places prefer translated names and fall back
to English before the native name. Sovereignty filters are applied afterward.

Sources:

- `https://vector.openstreetmap.org/styles/shortbread/neutrino.json`
- `https://vector.openstreetmap.org/styles/shortbread/eclipse.json`
- `https://vector.openstreetmap.org/styles/shortbread/sprites/basics/`

Refresh the checked-in copies from the repository root:

```powershell
pwsh -File client/scripts/sync-shortbread-assets.ps1
```

The application removes the remote glyph URL at runtime and uses local system
fonts, so font PBF files are intentionally not mirrored. OpenStreetMap
attribution embedded in the vector source is preserved.
