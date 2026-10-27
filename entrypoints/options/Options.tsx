import { useEffect, useMemo, useState } from 'react';
import { ConnectionForm } from '@/components/ConnectionForm';
import { RuleCard } from '@/components/RuleCard';
import { RuleEditor } from '@/components/RuleEditor';
import {
  AlertIcon,
  CloseIcon,
  PlusIcon,
  SparkIcon,
} from '@/components/icons';
import { Switch } from '@/components/Switch';
import { parseDomainInput } from '@/lib/domain';
import { selectedMrFromOption } from '@/lib/format';
import { domainToUrlPattern } from '@/lib/pattern';
import { countActiveRules, isConfigured } from '@/lib/rules';
import type { InjectionRule, MrOption } from '@/lib/types';
import { useAppState } from '@/lib/useAppState';
import { useInjectionStatus } from '@/lib/useInjectionStatus';
import './options.css';

export default function Options() {
  const {
    settings,
    rules,
    loading,
    error,
    reload,
    updateSettings,
    addRule,
    updateRule,
    removeRule,
    setRuleEnabled,
    setSelectedMr,
    setRuleMrMeta,
  } = useAppState();
  const { status } = useInjectionStatus();

  const [editor, setEditor] = useState<{
    rule: InjectionRule | null;
    initialPattern?: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InjectionRule | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantsNew = params.get('new') === '1' || window.location.hash === '#new';
    if (!wantsNew) return;
    const rawInitial = params.get('pattern') ?? params.get('domain') ?? '';
    let initialPattern = rawInitial;
    if (!params.get('pattern') && rawInitial) {
      const parsed = parseDomainInput(rawInitial);
      initialPattern = parsed.ok ? domainToUrlPattern(parsed.domain) : rawInitial;
    }
    const timer = setTimeout(() => {
      setEditor({ rule: null, initialPattern });
      history.replaceState(null, '', window.location.pathname);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const activeCount = useMemo(
    () => (settings ? countActiveRules(rules, settings) : 0),
    [rules, settings],
  );

  if (loading) {
    return (
      <main className="page page-loading">
        <span className="spinner" />
        <span>正在读取配置…</span>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="page page-loading">
        <div className="notice notice-error">
          <AlertIcon />
          <span>{error ?? '无法读取扩展配置'}</span>
        </div>
        <button type="button" className="btn" onClick={() => void reload()}>
          重试
        </button>
      </main>
    );
  }

  const configured = isConfigured(settings);

  const handleSaveRule = async (next: InjectionRule) => {
    if (editor?.rule) {
      await updateRule(next.id, next);
      setNotice('规则已更新');
    } else {
      await addRule(next);
      setNotice('规则已添加');
    }
  };

  const handleToggle = async (rule: InjectionRule, enabled: boolean) => {
    await setRuleEnabled(rule.id, enabled);
  };

  const handleSelectTag = async (rule: InjectionRule, mr: MrOption | null) => {
    await setSelectedMr(
      rule.id,
      mr ? selectedMrFromOption(mr, rule.projectPath) : null,
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeRule(deleteTarget.id);
      setDeleteTarget(null);
      setNotice('规则已删除');
    } finally {
      setDeleting(false);
    }
  };

  const statusTone = status?.error
    ? 'danger'
    : !settings.masterEnabled
      ? 'muted'
      : status?.appliedRuleCount
        ? 'ok'
        : 'muted';
  const statusText = status?.error
    ? '同步异常'
    : !settings.masterEnabled
      ? '已暂停'
      : (status?.appliedRuleCount ?? 0) > 0
        ? `${status?.appliedRuleCount} 条规则生效中`
        : !configured
          ? '未连接 GitLab'
          : activeCount > 0
            ? '应用中'
            : rules.length > 0
              ? '待选择 MR'
              : '暂无规则';

  return (
    <main className="page">
      <header className="page-header">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <SparkIcon />
          </div>
          <div>
            <h1 className="brand-title">MR Header Injector</h1>
            <p className="brand-subtitle">
              按请求 URL 注入请求头或重定向
            </p>
          </div>
        </div>

        <div className="header-right">
          <div className={`status-pill status-${statusTone}`}>
            <span className="status-dot" />
            {statusText}
          </div>
          <div className="master-card">
            <div className="master-title">总开关</div>
            <Switch
              checked={settings.masterEnabled}
              onChange={(checked) => void updateSettings({ masterEnabled: checked })}
              label="注入总开关"
            />
          </div>
        </div>
      </header>

      {status?.error ? (
        <div className="notice notice-error page-notice">
          <AlertIcon />
          <span>{status.error}</span>
        </div>
      ) : null}

      {status?.warning ? (
        <div className="notice notice-warning page-notice">
          <AlertIcon />
          <span>{status.warning}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="notice notice-success page-notice">
          <span>{notice}</span>
        </div>
      ) : null}

      <section id="connection" className="card connection-card">
        <ConnectionForm
          settings={settings}
          onSave={async (patch) => {
            await updateSettings(patch);
            setNotice('已保存');
          }}
        />
      </section>

      <section id="overlay" className="card overlay-card">
        <div className="overlay-copy">
          <h2 className="overlay-title">悬浮窗口</h2>
          <p className="overlay-desc">
            开启后，只有当前页面 URL 命中请求头规则时才显示悬浮窗口；重定向规则不影响它，规则停用也不会隐藏。
          </p>
        </div>
        <div className={`overlay-control${settings.pageOverlayEnabled ? ' is-on' : ''}`}>
          <span>{settings.pageOverlayEnabled ? '已开启' : '已关闭'}</span>
          <Switch
            checked={settings.pageOverlayEnabled}
            onChange={(checked) => void updateSettings({ pageOverlayEnabled: checked })}
            label="页面悬浮窗口"
          />
        </div>
      </section>

      <section className="rules-section" id="rules">
        <div className="section-head">
          <div>
            <h2 className="section-title">匹配规则</h2>
            <p className="section-subtitle">{rules.length} 条规则</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditor({ rule: null })}
          >
            <PlusIcon />
            添加规则
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="card empty">
            <div className="empty-icon">
              <SparkIcon />
            </div>
            <div className="empty-title">暂无规则</div>
            <p>配置请求 URL 正则、仓库和 Header，或添加重定向规则。</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditor({ rule: null })}
            >
              <PlusIcon />
              添加规则
            </button>
          </div>
        ) : (
          <div className="rules-list">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                settings={settings}
                variant="page"
                onToggle={(enabled) => void handleToggle(rule, enabled)}
                onSelectTag={(mr) => void handleSelectTag(rule, mr)}
                onSaveMeta={(meta) => void setRuleMrMeta(rule.id, meta)}
                onEdit={() => setEditor({ rule })}
                onDelete={() => setDeleteTarget(rule)}
              />
            ))}
          </div>
        )}
      </section>

      {editor ? (
        <RuleEditor
          key={editor.rule?.id ?? `new-${editor.initialPattern ?? ''}`}
          settings={settings}
          rules={rules}
          rule={editor.rule}
          initialPattern={editor.initialPattern}
          onClose={() => setEditor(null)}
          onSave={handleSaveRule}
        />
      ) : null}

      {deleteTarget ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <div
            className="modal modal-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title" id="delete-title">
                  删除规则
                </h2>
                <p className="modal-subtitle">
                  确定删除 <code title={deleteTarget.pattern}>{deleteTarget.pattern}</code>？
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDeleteTarget(null)}
                aria-label="关闭"
                disabled={deleting}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="modal-footer delete-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? '删除中…' : '删除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
