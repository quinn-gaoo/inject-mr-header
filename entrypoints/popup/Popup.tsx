import { useCallback } from 'react';
import { browser } from 'wxt/browser';
import { RuleCard } from '@/components/RuleCard';
import { AlertIcon, GearIcon, PlugIcon, PlusIcon } from '@/components/icons';
import { Switch } from '@/components/Switch';
import { selectedMrFromOption } from '@/lib/format';
import type { InjectionRule, MrOption } from '@/lib/types';
import { useAppState } from '@/lib/useAppState';
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

  const headerRules = rules
    .filter((rule) => rule.mode === 'header')
    .sort((a, b) => b.pattern.length - a.pattern.length);

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
          <div className="popup-brand-text">
            <div className="popup-title">MR Header</div>
            <div className="popup-subtitle">按请求 URL 注入 MR 请求头</div>
          </div>
        </div>
        <div className="popup-header-actions">
          <div className="popup-master">
            <span className="popup-toggle-label">总开关</span>
            <Switch
              checked={settings.masterEnabled}
              onChange={(checked) => void updateSettings({ masterEnabled: checked })}
              label="注入总开关"
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

      {headerRules.length > 0 ? (
        <main className="popup-main">
          <div className="popup-rules">
            {headerRules.map((rule) => (
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
      ) : (
        <main className="popup-main">
          <div className="popup-empty">
            <div className="empty-icon">
              <PlugIcon />
            </div>
            <div className="empty-title">还没有配置请求头规则</div>
            <p>
              在 options 里添加规则并加载 MR 后，就可以在这里选择要注入的 MR。
            </p>
            <div className="popup-empty-actions">
              <button type="button" className="btn btn-primary" onClick={openOptions}>
                <PlusIcon />
                添加规则
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
