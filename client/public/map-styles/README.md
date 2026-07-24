# Bundled OpenStreetMap Shortbread presentation assets

The production frontend serves these style and sprite files from its own
origin. This avoids relying on the origin allow-list used by the OpenStreetMap
style server while the browser still requests interactive vector tiles from
the official Shortbread tile endpoint.

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
