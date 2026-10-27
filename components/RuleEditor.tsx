import { useEffect, useState, type FormEvent } from 'react';
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
  initialPattern?: string;
  onClose: () => void;
  onSave: (rule: InjectionRule) => Promise<void>;
}

export function RuleEditor({
  settings,
  rules,
  rule,
  initialPattern,
  onClose,
  onSave,
}: RuleEditorProps) {
  const [draft, setDraft] = useState<RuleDraft>(() => {
    if (rule) {
      return {
        mode: rule.mode,
        pattern: rule.pattern,
        redirectTarget: rule.redirectTarget,
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
      pattern: initialPattern?.trim() ?? '',
    };
  });
  const [errors, setErrors] = useState<RuleDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const isRedirect = draft.mode === 'redirect';

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
    const isHeader = normalized.mode === 'header';
    const nextRule: InjectionRule = {
      id: rule?.id ?? createId(),
      mode: normalized.mode,
      pattern: normalized.pattern,
      redirectTarget: normalized.redirectTarget,
      headerName: normalized.headerName,
      projectPath: normalized.projectPath,
      mrState: normalized.mrState,
      perPage: normalized.perPage,
      extraQuery: normalized.extraQuery,
      enabled: normalized.enabled,
      selectedMr:
        isHeader &&
        rule?.selectedMr &&
        rule.selectedMr.projectPath === normalized.projectPath
          ? rule.selectedMr
          : null,
      mrMeta:
        isHeader && rule && rule.projectPath === normalized.projectPath
          ? rule.mrMeta ?? {}
          : {},
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
            <p className="modal-subtitle">
              {isRedirect
                ? '配置请求 URL 正则和重定向目标。'
                : '配置请求 URL 正则、仓库和 Header。'}
            </p>
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
            <div className="form-section-label">匹配</div>

            <div className="field">
              <span className="field-label">模式</span>
              <div
                className={`mode-switch${isRedirect ? ' is-redirect' : ''}`}
                role="radiogroup"
                aria-label="规则模式"
              >
                <span className="mode-switch-thumb" aria-hidden="true" />
                <button
                  type="button"
                  role="radio"
                  aria-checked={!isRedirect}
                  className={`mode-switch-option${isRedirect ? '' : ' is-active'}`}
                  onClick={() => {
                    update('mode', 'header');
                    setErrors({});
                  }}
                >
                  注入请求头
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isRedirect}
                  className={`mode-switch-option${isRedirect ? ' is-active' : ''}`}
                  onClick={() => {
                    update('mode', 'redirect');
                    setErrors({});
                  }}
                >
                  请求重定向
                </button>
              </div>
            </div>

            <label className="field">
              <span className="field-label">匹配正则</span>
              <input
                className={`input mono${errors.pattern ? ' is-invalid' : ''}`}
                type="text"
                placeholder={'^https?://([a-z0-9-]+\\.)*aaa\\.com/'}
                value={draft.pattern}
                spellCheck={false}
                autoComplete="off"
                autoFocus
                onChange={(event) => update('pattern', event.target.value)}
              />
              {errors.pattern ? (
                <span className="field-error">{errors.pattern}</span>
              ) : (
                <span className="field-hint">
                  正则直接匹配请求 URL，例如 <code>{'aaa\\.com'}</code> 或{' '}
                  <code>{'^https?://www\\.aaa\\.com/api/'}</code>
                </span>
              )}
            </label>

            {isRedirect ? (
              <label className="field">
                <span className="field-label">目标域名 / Origin</span>
                <input
                  className={`input mono${errors.redirectTarget ? ' is-invalid' : ''}`}
                  type="text"
                  placeholder="https://qiangqiang.work/api"
                  value={draft.redirectTarget}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => update('redirectTarget', event.target.value)}
                />
                {errors.redirectTarget ? (
                  <span className="field-error">{errors.redirectTarget}</span>
                ) : (
                  <span className="field-hint">
                    只填域名会保留原路径；带路径会改为该固定路径，query 保留
                  </span>
                )}
              </label>
            ) : (
              <>
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
                    {errors.perPage ? (
                      <span className="field-error">{errors.perPage}</span>
                    ) : null}
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
              </>
            )}

            <div className="form-section-label">状态</div>
            <div className="switch-row">
              <Switch
                checked={draft.enabled}
                onChange={(checked) => update('enabled', checked)}
                label="启用这条规则"
              />
              <span>{draft.enabled ? '启用' : '停用'}</span>
              <span className="field-hint">
                {isRedirect ? '停用后不重定向' : '停用后不注入'}
              </span>
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
