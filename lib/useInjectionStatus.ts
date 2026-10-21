import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { subscribeToAppState } from './storage';
import type { InjectionStatus } from './types';

export function useInjectionStatus(): {
  status: InjectionStatus | null;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<InjectionStatus | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        type: 'mrh:get-status',
      })) as InjectionStatus | undefined;
      if (response) setStatus(response);
    } catch {
      // 扩展后台正在重启或上下文已失效时忽略
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeToAppState(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void refresh();
      }, 450);
    });
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  return { status, refresh };
}
