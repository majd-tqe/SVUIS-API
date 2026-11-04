import { expect, it } from 'vitest';
import { swaggerSpec } from '../src/swagger.js';

it('exports the route documentation on Windows with resolvable schema references', () => {
  const spec = swaggerSpec as { paths: Record<string, unknown>; components: unknown };
  expect(spec.paths).toHaveProperty('/api/v1/studies/profile');
  expect(spec.paths).toHaveProperty('/api/v1/classes/schedule');
  expect(spec.paths).toHaveProperty('/api/v1/classes/schedule/options');
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (typeof object.$ref === 'string' && object.$ref.startsWith('#/')) {
      const target = object.$ref.slice(2).split('/').reduce<unknown>((current, key) => (current as Record<string, unknown>)?.[key], spec);
      expect(target, object.$ref).toBeDefined();
    }
    Object.values(object).forEach(walk);
  };
  walk(spec);
});
