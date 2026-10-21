import { useEffect, useState, type FormEvent } from 'react';
import { parseDomainInput } from '@/lib/domain';
import { describeError } from '@/lib/errors';
import { normalizeProjectPath } from '@/lib/gitlab';
import {
  createEmptyDraft,
  validateRuleDraft,
  type RuleDraft,
  type RuleDraftErrors,
} from '@/lib/rules';
import { createId } from '@/lib/storage';
import {
  MR_STATE_OPTIONS,
  type AppSettings,
  type InjectionRule,
  type MrState,
} from '@/lib/types';
import { CloseIcon } from './icons';
import { Switch } from './Switch';

interface RuleEditorProps {
  settings: AppSettings;
  rules: InjectionRule[];
  rule: InjectionRule | null;
  initialDomain?: string;
  onClose: () => void;
  onSave: (rule: InjectionRule) => Promise<void>;
}

export function RuleEditor({
  settings,
  rules,
  rule,
  initialDomain,
  onClose,
  onSave,
}: RuleEditorProps) {
  const [draft, setDraft] = useState<RuleDraft>(() => {
    if (rule) {
      return {
        domain: rule.domain,
        headerName: rule.headerName,
        projectPath: rule.projectPath,
        mrState: rule.mrState,
        perPage: rule.perPage,
        extraQuery: rule.extraQuery,
        enabled: rule.enabled,
      };
    }
    return {
      ...createEmptyDraft(),
      domain: initialDomain?.trim() ?? '',
    };
  });
  const [errors, setErrors] = useState<RuleDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const domainPreview = draft.domain.trim() ? parseDomainInput(draft.domain) : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  const update = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { errors: nextErrors, normalized } = validateRuleDraft(draft, rules, rule?.id);
    if (!normalized) {
      setErrors(nextErrors);
      return;
    }

    const now = Date.now();
    const nextRule: InjectionRule = {
      id: rule?.id ?? createId(),
      domain: normalized.domain,
      headerName: normalized.headerName,
      projectPath: normalized.projectPath,
      mrState: normalized.mrState,
      perPage: normalized.perPage,
      extraQuery: normalized.extraQuery,
      enabled: normalized.enabled,
      selectedMr:
        rule?.selectedMr && rule.selectedMr.projectPath === normalized.projectPath
          ? rule.selectedMr
          : null,
      createdAt: rule?.createdAt ?? now,
      updatedAt: now,
    };

    setSaving(true);
    try {
      await onSave(nextRule);
      onClose();
    } catch (cause) {
      setErrors({ form: describeError(cause) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rule-editor-title">
        <div className="modal-header">
          <div>
            <h2 className="modal-title" id="rule-editor-title">
              {rule ? '编辑规则' : '添加规则'}
            </h2>
            <p className="modal-subtitle">配置页面域名、仓库和 Header。</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="关闭"
            disabled={saving}
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="modal-body">
            <div className="form-section-label">匹配规则</div>

            <label className="field">
              <span className="field-label">页面域名</span>
              <input
                className={`input mono${errors.domain ? ' is-invalid' : ''}`}
                type="text"
                placeholder="*.aaa.com"
                value={draft.domain}
                spellCheck={false}
                autoComplete="off"
                autoFocus
                onChange={(event) => update('domain', event.target.value)}
              />
              {errors.domain ? (
                <span className="field-error">{errors.domain}</span>
              ) : domainPreview?.ok ? (
                <span className="field-hint">
                  匹配 <code>{domainPreview.domain}</code> 及其子域
                </span>
              ) : (
                <span className="field-hint">支持域名、通配符或完整 URL</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">仓库</span>
              <input
                className={`input mono${errors.projectPath ? ' is-invalid' : ''}`}
                type="text"
                placeholder="group/a-front"
                value={draft.projectPath}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => update('projectPath', event.target.value)}
                onBlur={() =>
                  update(
                    'projectPath',
                    normalizeProjectPath(draft.projectPath, settings.gitlabBaseUrl),
                  )
                }
              />
              {errors.projectPath ? (
                <span className="field-error">{errors.projectPath}</span>
              ) : (
                <span className="field-hint">支持 group/project、ID 或仓库 URL</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">Header</span>
              <input
                className={`input mono${errors.headerName ? ' is-invalid' : ''}`}
                type="text"
                placeholder="X-MR-ID"
                value={draft.headerName}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => update('headerName', event.target.value)}
              />
              {errors.headerName ? (
                <span className="field-error">{errors.headerName}</span>
              ) : (
                <span className="field-hint">默认 X-MR-ID</span>
              )}
            </label>

            <div className="form-section-label">
              MR 筛选
              <span className="optional">可选</span>
            </div>

            <div className="form-grid-2">
              <label className="field">
                <span className="field-label">MR 状态</span>
                <select
                  className="select"
                  value={draft.mrState}
                  onChange={(event) => update('mrState', event.target.value as MrState)}
                >
                  {MR_STATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">可选范围</span>
              </label>

              <label className="field">
                <span className="field-label">
                  每页数量
                  <span className="optional">最多 100</span>
                </span>
                <input
                  className={`input${errors.perPage ? ' is-invalid' : ''}`}
                  type="number"
                  min={1}
                  max={100}
                  value={draft.perPage || ''}
                  onChange={(event) => update('perPage', Number(event.target.value))}
                />
                {errors.perPage ? <span className="field-error">{errors.perPage}</span> : null}
              </label>
            </div>

            <label className="field">
              <span className="field-label">
                额外参数
                <span className="optional">可选</span>
              </span>
              <textarea
                className={`textarea${errors.extraQuery ? ' is-invalid' : ''}`}
                placeholder="labels=bug&author_username=me"
                value={draft.extraQuery}
                spellCheck={false}
                onChange={(event) => update('extraQuery', event.target.value)}
              />
              {errors.extraQuery ? (
                <span className="field-error">{errors.extraQuery}</span>
              ) : (
                <span className="field-hint">例如 labels=bug</span>
              )}
            </label>

            <div className="form-section-label">状态</div>
            <div className="switch-row">
              <Switch
                checked={draft.enabled}
                onChange={(checked) => update('enabled', checked)}
                label="启用这条规则"
              />
              <span>{draft.enabled ? '启用' : '停用'}</span>
              <span className="field-hint">停用后不注入</span>
            </div>

            {errors.form ? (
              <div className="notice notice-error">
                <span>{errors.form}</span>
              </div>
            ) : null}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中…' : rule ? '保存修改' : '添加规则'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
