import type { AppSettings, InjectionRule, MrMetaMap, MrOption, SelectedMr } from '@/lib/types';
import { PopupMrTagPicker } from './PopupMrTagPicker';
import { RuleMrCache } from './RuleMrCache';
import { Switch } from './Switch';
import { PencilIcon, TrashIcon } from './icons';

interface RuleCardProps {
  rule: InjectionRule;
  settings: AppSettings;
  variant?: 'popup' | 'page';
  onToggle: (enabled: boolean) => void;
  onSelectTag?: (mr: MrOption | null) => void;
  onSaveMeta?: (meta: MrMetaMap) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function RulePattern({ pattern }: { pattern: string }) {
  return (
    <div className="rule-pattern" title={pattern}>
      <span className="rule-pattern-label">匹配</span>
      <code>{pattern || '未设置正则'}</code>
    </div>
  );
}

export function RuleCard({
  rule,
  settings,
  variant = 'page',
  onToggle,
  onSelectTag,
  onSaveMeta,
  onEdit,
  onDelete,
}: RuleCardProps) {
  const selectedMr: SelectedMr | null =
    rule.selectedMr && rule.selectedMr.projectPath === rule.projectPath
      ? rule.selectedMr
      : null;
  const isRedirect = rule.mode === 'redirect';
  const toggleLabel = isRedirect
    ? `${rule.pattern || '重定向规则'} 启用开关`
    : `${rule.headerName || rule.pattern || '规则'} 启用开关`;

  if (variant === 'popup') {
    return (
      <article className={`rule-card${rule.enabled ? '' : ' is-disabled'}`}>
        <header className="rule-head">
          <div className="rule-title">
            <span className="rule-header-tag" title={rule.pattern || undefined}>
              {rule.headerName || 'X-MR-ID'}
            </span>
          </div>
          <Switch
            checked={rule.enabled}
            onChange={onToggle}
            label={toggleLabel}
            size="sm"
          />
        </header>

        {onSelectTag ? (
          <PopupMrTagPicker
            rule={rule}
            settings={settings}
            onSelect={onSelectTag}
          />
        ) : null}
      </article>
    );
  }

  return (
    <article className={`rule-card${rule.enabled ? '' : ' is-disabled'}`}>
      <header className="rule-head">
        <div className="rule-title">
          {isRedirect ? (
            <span className="rule-mode-tag">重定向</span>
          ) : (
            <span className="rule-header-tag" title={rule.pattern || undefined}>
              {rule.headerName || 'X-MR-ID'}
            </span>
          )}
        </div>
        <Switch
          checked={rule.enabled}
          onChange={onToggle}
          label={toggleLabel}
          size="sm"
        />
      </header>

      {isRedirect ? (
        <div className="rule-redirect-meta">
          <div className="rule-redirect-row" title={rule.pattern}>
            <span className="rule-pattern-label">匹配</span>
            <code>{rule.pattern || '未设置正则'}</code>
          </div>
          <div className="rule-redirect-row" title={rule.redirectTarget}>
            <span className="rule-pattern-label">目标</span>
            <code>{rule.redirectTarget || '未设置目标'}</code>
          </div>
        </div>
      ) : (
        <>
          <RulePattern pattern={rule.pattern} />
          <RuleMrCache
            rule={rule}
            settings={settings}
            selectedMr={selectedMr}
            onSelect={onSelectTag}
            onSaveMeta={onSaveMeta}
          />
        </>
      )}

      <footer className="rule-actions">
        <button type="button" className="link-btn" onClick={onEdit}>
          <PencilIcon />
          编辑
        </button>
        <button type="button" className="link-btn is-danger" onClick={onDelete}>
          <TrashIcon />
          删除
        </button>
      </footer>
    </article>
  );
}
