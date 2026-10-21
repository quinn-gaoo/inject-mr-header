import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getHostname } from './domain';

export function useCurrentTabHost(): string | null {
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (!alive) return;
        setHost(getHostname(tabs[0]?.url));
      })
      .catch(() => {
        if (alive) setHost(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  return host;
}
