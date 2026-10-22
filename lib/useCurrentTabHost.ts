import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getHostname } from './domain';

/** host 为 null 时可能还没读到（ready=false），也可能是页面不支持注入（ready=true）。 */
export function useCurrentTabHost(): { host: string | null; ready: boolean } {
  const [host, setHost] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (!alive) return;
        setHost(getHostname(tabs[0]?.url));
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setHost(null);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { host, ready };
}
