import { ITEMS } from '../sim/data';
import { tEntity } from './entity_i18n';

/**
 * Resolve a typed market Browse search term to a canonical item name/ID.
 *
 * Lives here (a leaf core helper) rather than in `market_window.ts` so the
 * market painter stays a thin DOM view with no direct sim-data import — see
 * `src/ui/market_window.ts` header ("holds no Sim reference") and the
 * `builds the rows in the pure core, leaving the painter no item resolution`
 * pin in tests/market_window.test.ts. The host (Hud) injects this as
 * `deps.resolveSearchTerm`.
 */
export function resolveMarketSearchTerm(searchTerm: string): string {
  if (!searchTerm) return searchTerm;
  const lcSearch = searchTerm.trim().toLowerCase();
  for (const [id, item] of Object.entries(ITEMS)) {
    if (tEntity({ kind: 'item', id, field: 'name' }).toLowerCase().includes(lcSearch)) {
      return item.name ?? id;
    }
  }
  return searchTerm;
}
