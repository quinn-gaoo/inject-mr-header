import { useCallback } from 'react';
import { browser } from 'wxt/browser';
import { RuleCard } from '@/components/RuleCard';
import { AlertIcon, GearIcon } from '@/components/icons';
import { Switch } from '@/components/Switch';
import { hostMatchesDomain } from '@/lib/domain';
import { selectedMrFromOption } from '@/lib/format';
import type { InjectionRule, MrOption } from '@/lib/types';
import { useAppState } from '@/lib/useAppState';
import { useCurrentTabHost } from '@/lib/useCurrentTabHost';
import './popup.css';

export default function Popup() {
  const {
    settings,
    rules,
    loading,
    error,
    updateSettings,
    setRuleEnabled,
    setSelectedMr,
  } = useAppState();
  const currentHost = useCurrentTabHost();

  const openOptions = useCallback(() => {
    const url = browser.runtime.getURL('/options.html');
    void browser.tabs.create({ url }).finally(() => window.close());
  }, []);

  if (loading) {
    return (
      <div className="popup popup-loading">
        <span className="spinner" />
        <span>正在读取配置…</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="popup popup-loading">
        <div className="notice notice-error">
          <AlertIcon />
          <span>{error ?? '无法读取扩展配置'}</span>
        </div>
        <button type="button" className="btn" onClick={openOptions}>
          打开设置
        </button>
      </div>
    );
  }

  const matchedRules = currentHost
    ? rules
        .filter((rule) => hostMatchesDomain(currentHost, rule.domain))
        .sort((a, b) => b.domain.length - a.domain.length)
    : [];

  const handleSelectTag = async (rule: InjectionRule, mr: MrOption | null) => {
    await setSelectedMr(
      rule.id,
      mr ? selectedMrFromOption(mr, rule.projectPath) : null,
    );
  };

  return (
    <div className="popup">
      <header className="popup-header">
        <div className="popup-brand">
          <div className="popup-mark" aria-hidden="true">
            MR
          </div>
          <div className="popup-title">MR Header</div>
        </div>
        <div className="popup-header-actions">
          <div className="popup-toggle">
            <span>插件</span>
            <Switch
              checked={settings.masterEnabled}
              onChange={(checked) => void updateSettings({ masterEnabled: checked })}
              label="注入总开关"
              size="sm"
            />
          </div>
          <div className="popup-toggle">
            <span>悬浮</span>
            <Switch
              checked={settings.pageOverlayEnabled}
              onChange={(checked) => void updateSettings({ pageOverlayEnabled: checked })}
              label="页面悬浮入口"
              size="sm"
            />
          </div>
          <button
            type="button"
            className="icon-btn"
            title="设置"
            aria-label="打开设置"
            onClick={openOptions}
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {matchedRules.length > 0 ? (
        <main className="popup-main">
          <div className="popup-rules">
            {matchedRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                settings={settings}
                variant="popup"
                onToggle={(enabled) => void setRuleEnabled(rule.id, enabled)}
                onSelectTag={(mr) => void handleSelectTag(rule, mr)}
              />
            ))}
          </div>
        </main>
      ) : null}
    </div>
  );
}
