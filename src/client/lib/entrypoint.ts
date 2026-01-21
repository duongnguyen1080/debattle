const getDevvitGlobal = (): { entrypoints?: Record<string, string>; webViewMode?: unknown } | undefined => {
  return (globalThis as any).devvit as { entrypoints?: Record<string, string> } | undefined;
};

export const getDevvitAvailable = (): boolean => {
  return Boolean(getDevvitGlobal());
};

export const resolveEntrypointName = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  const entryParam = url.searchParams.get('entrypoint') || url.searchParams.get('entry');
  if (entryParam) {
    return entryParam;
  }

  const devvit = getDevvitGlobal();
  if (!devvit?.entrypoints) {
    return null;
  }

  for (const [name, entryUrl] of Object.entries(devvit.entrypoints)) {
    try {
      const parsed = new URL(String(entryUrl));
      if (parsed.origin === url.origin && parsed.pathname === url.pathname) {
        return name;
      }
    } catch {
      // Ignore malformed entrypoint URLs.
    }
  }

  return null;
};
