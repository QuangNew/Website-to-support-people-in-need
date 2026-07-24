import { expect, test } from '@playwright/test';
import {
  applyVietnamSovereigntyPolicy,
  SOVEREIGNTY_BLOCKED_NAMES,
} from '../client/src/components/map/vietnamBasemapStyle';

test.describe('Vietnam sovereignty basemap policy', () => {
  test('filters disputed maritime boundaries while preserving existing filters', () => {
    const style = applyVietnamSovereigntyPolicy({
      version: 8,
      sources: {},
      layers: [
        {
          id: 'state-boundaries',
          type: 'line',
          source: 'shortbread',
          'source-layer': 'boundaries',
          filter: ['==', ['get', 'admin_level'], 4],
          paint: { 'line-color': '#000000' },
        },
      ],
    });

    const filter = JSON.stringify(style.layers[0].filter);
    expect(filter).toContain('admin_level');
    expect(filter).toContain('maritime');
    expect(filter).toContain('disputed');
  });

  test('blocks Sansha and duplicate Paracel/Spratly labels', () => {
    const style = applyVietnamSovereigntyPolicy({
      version: 8,
      sources: {},
      layers: [
        {
          id: 'place-labels',
          type: 'symbol',
          source: 'shortbread',
          'source-layer': 'place_labels',
          layout: { 'text-field': ['get', 'name'] },
        },
      ],
    });

    const filter = JSON.stringify(style.layers[0].filter);
    expect(filter).toContain('name_en');
    expect(filter).toContain('sansha');
    expect(SOVEREIGNTY_BLOCKED_NAMES).toContain('paracel islands');
    expect(SOVEREIGNTY_BLOCKED_NAMES).toContain('spratly islands');
    expect(SOVEREIGNTY_BLOCKED_NAMES).toContain('三沙市');
  });
});
