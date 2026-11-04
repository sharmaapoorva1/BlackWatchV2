/** The query string for `params` without `omit`, or the bare path if empty. */
export function hrefWithout(
  basePath: string,
  params: Record<string, string | undefined>,
  omit?: string,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === omit || value === undefined || value === "") continue;
    search.set(key, value);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Params that actually have a value (empty strings count as unset). */
export function activeParams(params: Record<string, string | undefined>): [string, string][] {
  return Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "");
}
