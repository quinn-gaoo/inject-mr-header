import { useCallback } from 'react';
import { browser } from 'wxt/browser';
import { RuleCard } from '@/components/RuleCard';
import { AlertIcon, GearIcon, PlugIcon, PlusIcon } from '@/components/icons';
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
  const { host: currentHost, ready: hostReady } = useCurrentTabHost();

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
          <div className="popup-brand-text">
            <div className="popup-title">MR Header</div>
            <div className="popup-subtitle">按域名注入 MR 请求头</div>
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

      {!hostReady ? (
        <main className="popup-main">
          <div className="popup-empty">
            <span className="spinner" />
            <p>正在读取当前页面…</p>
          </div>
        </main>
      ) : matchedRules.length > 0 ? (
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
      ) : (
        <main className="popup-main">
          <div className="popup-empty">
            <div className="empty-icon">
              <PlugIcon />
            </div>
            <div className="empty-title">
              {currentHost ? '当前页面没有匹配的规则' : '当前页面不支持注入'}
            </div>
            <p>
              {currentHost ? (
                <>
                  还没有为 <code>{currentHost}</code> 配置规则。添加后，这个域名下的页面请求会自动带上所选 MR 的请求头。
                </>
              ) : (
                'MR Header 只能作用于 http/https 页面，请先打开需要注入请求头的业务页面。'
              )}
            </p>
            {currentHost ? (
              <div className="popup-empty-actions">
                <button type="button" className="btn btn-primary" onClick={openOptions}>
                  <PlusIcon />
                  添加规则
                </button>
              </div>
            ) : null}
          </div>
        </main>
      )}
    </div>
  );
}
