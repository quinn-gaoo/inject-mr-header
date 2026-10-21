import type { AppSettings, InjectionRule, MrOption, SelectedMr } from '@/lib/types';
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
  onEdit?: () => void;
  onDelete?: () => void;
}

export function RuleCard({
  rule,
  settings,
  variant = 'page',
  onToggle,
  onSelectTag,
  onEdit,
  onDelete,
}: RuleCardProps) {
  const selectedMr =
    rule.selectedMr && rule.selectedMr.projectPath === rule.projectPath
      ? rule.selectedMr
      : null;

  if (variant === 'page') {
    return (
      <article className={`rule-card${rule.enabled ? '' : ' is-disabled'}`}>
        <header className="rule-head">
          <div className="rule-title">
            <span className="rule-domain" title={`${rule.domain}（匹配所有子域）`}>
              {rule.domain || '未设置域名'}
            </span>
            <span className="rule-header-tag">{rule.headerName || 'X-MR-ID'}</span>
          </div>
          <Switch
            checked={rule.enabled}
            onChange={onToggle}
            label={`${rule.domain || '规则'} 启用开关`}
            size="sm"
          />
        </header>

        <RuleMrCache
          rule={rule}
          settings={settings}
          selectedMr={selectedMr}
          onSelect={onSelectTag}
        />

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

  return (
    <article className={`rule-card${rule.enabled ? '' : ' is-disabled'}`}>
      <header className="rule-head">
        <div className="rule-title">
          <span className="rule-domain" title={`${rule.domain}（匹配所有子域）`}>
            {rule.domain || '未设置域名'}
          </span>
        </div>
        <Switch
          checked={rule.enabled}
          onChange={onToggle}
          label={`${rule.domain || '规则'} 启用开关`}
          size="sm"
        />
      </header>

      <div className="rule-meta">
        <span className="mono" title={rule.projectPath}>
          {rule.projectPath || '未设置仓库'}
        </span>
        <span className="rule-meta-dot" />
        <span className="mono">{rule.headerName}</span>
      </div>

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
