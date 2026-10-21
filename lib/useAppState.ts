import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearMrCacheForRule,
  mutateRules,
  patchSettings,
  readAppState,
  subscribeToAppState,
} from './storage';
import type {
  AppSettings,
  InjectionRule,
  SelectedMr,
  StoredAppState,
} from './types';

export interface AppStateApi {
  settings: AppSettings | null;
  rules: InjectionRule[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  addRule: (rule: InjectionRule) => Promise<void>;
  updateRule: (id: string, patch: Partial<InjectionRule>) => Promise<void>;
  removeRule: (id: string) => Promise<void>;
  setRuleEnabled: (id: string, enabled: boolean) => Promise<void>;
  setSelectedMr: (id: string, mr: SelectedMr | null) => Promise<void>;
}

export function useAppState(): AppStateApi {
  const [state, setState] = useState<StoredAppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadId = useRef(0);

  const reload = useCallback(async () => {
    const id = loadId.current + 1;
    loadId.current = id;
    try {
      const next = await readAppState();
      // 多次 storage 变更可能并发读取，只应用最后一次的结果，避免旧数据覆盖新状态
      if (loadId.current !== id) return;
      setState(next);
      setError(null);
    } catch (cause) {
      if (loadId.current !== id) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => {
    void reload();
    return subscribeToAppState(() => {
      void reload();
    });
  }, [reload]);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    await patchSettings(patch);
  }, []);

  const addRule = useCallback(async (rule: InjectionRule) => {
    await mutateRules((rules) => {
      rules.unshift(rule);
    });
  }, []);

  const updateRule = useCallback(async (id: string, patch: Partial<InjectionRule>) => {
    const cacheFields = ['projectPath', 'mrState', 'perPage', 'extraQuery'] as const;
    const result = await mutateRules((rules) => {
      const index = rules.findIndex((rule) => rule.id === id);
      const current = index >= 0 ? rules[index] : undefined;
      if (!current) return { updated: false, cacheChanged: false };
      const cacheChanged = cacheFields.some(
        (field) => patch[field] !== undefined && patch[field] !== current[field],
      );
      rules[index] = { ...current, ...patch, id: current.id, updatedAt: Date.now() };
      return { updated: true, cacheChanged };
    });
    if (result.updated && result.cacheChanged) {
      await clearMrCacheForRule(id);
    }
  }, []);

  const removeRule = useCallback(async (id: string) => {
    await mutateRules((rules) => {
      const index = rules.findIndex((rule) => rule.id === id);
      if (index >= 0) rules.splice(index, 1);
      return index >= 0;
    });
    await clearMrCacheForRule(id);
  }, []);

  const setRuleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      await updateRule(id, { enabled });
    },
    [updateRule],
  );

  const setSelectedMr = useCallback(
    async (id: string, mr: SelectedMr | null) => {
      await updateRule(id, { selectedMr: mr });
    },
    [updateRule],
  );

  return {
    settings: state?.settings ?? null,
    rules: state?.rules ?? [],
    loading: state === null && error === null,
    error,
    reload,
    updateSettings,
    addRule,
    updateRule,
    removeRule,
    setRuleEnabled,
    setSelectedMr,
  };
}
