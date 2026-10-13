import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Bundle the MapLibre 6 worker and its imports into a same-origin production asset.
setWorkerUrl(maplibreWorkerUrl);

export { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
