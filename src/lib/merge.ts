export function mergeDrafts<T extends { updated_at: string }>(local: T, remote: T, base?: T): T {
  if (!base) {
    // Fallback to last write wins if no base is provided
    const localTime = new Date(local.updated_at).getTime();
    const remoteTime = new Date(remote.updated_at).getTime();
    return localTime >= remoteTime ? local : remote;
  }

  const merged = { ...base } as any;
  const localAny = local as any;
  const remoteAny = remote as any;

  let latestUpdate = new Date(base.updated_at).getTime();

  for (const key in base) {
    if (key === 'updated_at') continue;

    const localChanged = localAny[key] !== base[key as keyof T];
    const remoteChanged = remoteAny[key] !== base[key as keyof T];

    if (localChanged && remoteChanged) {
      // Conflict on same field: last write wins
      const localTime = new Date(local.updated_at).getTime();
      const remoteTime = new Date(remote.updated_at).getTime();
      merged[key] = localTime >= remoteTime ? localAny[key] : remoteAny[key];
      latestUpdate = Math.max(latestUpdate, localTime, remoteTime);
    } else if (localChanged) {
      merged[key] = localAny[key];
      latestUpdate = Math.max(latestUpdate, new Date(local.updated_at).getTime());
    } else if (remoteChanged) {
      merged[key] = remoteAny[key];
      latestUpdate = Math.max(latestUpdate, new Date(remote.updated_at).getTime());
    }
  }

  // Also check for keys that might have been added (not in base)
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const key of allKeys) {
    if (!(key in base) && key !== 'updated_at') {
      const localTime = new Date(local.updated_at).getTime();
      const remoteTime = new Date(remote.updated_at).getTime();
      merged[key] = localTime >= remoteTime ? localAny[key] : remoteAny[key];
      latestUpdate = Math.max(latestUpdate, localTime, remoteTime);
    }
  }

  merged.updated_at = new Date(latestUpdate).toISOString();
  return merged as T;
}
