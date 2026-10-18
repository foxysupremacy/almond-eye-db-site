import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormattedEffectBadges } from './highlighted-numbers';

test('resolved special magnitude renders with an ASSUMED label when run data is missing', () => {
  const html = renderToStaticMarkup(<FormattedEffectBadges
    effects={[{ type: 22, value: 4500 }]}
    effectScalings={[{ effectIndex: 0, code: 30, baseValue: 1500, value: 4500, status: 'assumed', reason: 'Fan Love is unavailable; documented maximum 3x used' }]}
    baseTime={30000}
    courseLength={2000}
  />);
  expect(html).toContain('+0.45 m/s');
  expect(html).toContain('ASSUMED');
});

test('special scaling values retain the precision shown in the source table', () => {
  const html = renderToStaticMarkup(<FormattedEffectBadges
    effects={[{ type: 22, value: 4375 }]}
    effectScalings={[{ effectIndex: 0, code: 11, baseValue: 3500, value: 4375, status: 'assumed', reason: 'Maximum overtake tier used' }]}
    baseTime={30000}
    courseLength={2000}
  />);
  expect(html).toContain('+0.438 m/s');
});
