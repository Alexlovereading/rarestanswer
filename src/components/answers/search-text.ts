/**
 * Shared by the hub's server-rendered `data-search` attribute and the
 * client filter, so a query and the haystack fold the same way.
 */
export function foldSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
