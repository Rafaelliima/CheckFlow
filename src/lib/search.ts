export function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? '').toLowerCase();
}
