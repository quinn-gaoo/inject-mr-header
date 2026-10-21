import { useState, type FormEvent } from 'react';
import { describeError } from '@/lib/errors';
import { fetchCurrentUser, normalizeGitlabBaseUrl } from '@/lib/gitlab';
import type { AppSettings, GitLabIdentity } from '@/lib/types';
import {
  AlertIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  PlugIcon,
} from './icons';

interface ConnectionFormProps {
  settings: AppSettings;
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
}

type TestState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; user: GitLabIdentity }
  | { kind: 'error'; message: string };

export function ConnectionForm({ settings, onSave }: ConnectionFormProps) {
  const [baseUrl, setBaseUrl] = useState(settings.gitlabBaseUrl);
  const [token, setToken] = useState(settings.token);
  const [showToken, setShowToken] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetFeedback = () => {
    if (test.kind !== 'idle') setTest({ kind: 'idle' });
    if (error) setError(null);
  };

  const readDraft = (): AppSettings | null => {
    const normalized = normalizeGitlabBaseUrl(baseUrl);
    if (!normalized.ok) {
      setError(normalized.error);
      return null;
    }
    if (!token.trim()) {
      setError('请输入 Access Token');
      return null;
    }
    return {
      ...settings,
      gitlabBaseUrl: normalized.url,
      token: token.trim(),
    };
  };

  const handleTest = async () => {
    const draft = readDraft();
    if (!draft) {
      setTest({ kind: 'idle' });
      return;
    }
    setError(null);
    setTest({ kind: 'loading' });
    try {
      const user = await fetchCurrentUser(draft);
      setTest({ kind: 'success', user });
    } catch (cause) {
      setTest({ kind: 'error', message: describeError(cause) });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeGitlabBaseUrl(baseUrl);
    if (!normalized.ok) {
      setError(normalized.error);
      return;
    }
    if (!token.trim()) {
      setError('请输入 Access Token');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        gitlabBaseUrl: normalized.url,
        token: token.trim(),
      });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="connection-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="connection-head">
        <div className="connection-icon">
          <PlugIcon />
        </div>
        <div>
          <h2 className="section-title">GitLab 连接</h2>
        </div>
      </div>

      <div className="connection-grid">
        <label className="field">
          <span className="field-label">GitLab 地址</span>
          <input
            className="input"
            type="text"
            inputMode="url"
            placeholder="https://gitlab.example.com"
            value={baseUrl}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              setBaseUrl(event.target.value);
              resetFeedback();
            }}
          />
          <span className="field-hint">支持自建实例和子路径</span>
        </label>

        <label className="field">
          <span className="field-label">Access Token</span>
          <span className="input-wrap">
            <input
              className="input"
              type={showToken ? 'text' : 'password'}
              placeholder="glpat-..."
              value={token}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                setToken(event.target.value);
                resetFeedback();
              }}
            />
            <button
              type="button"
              className="input-affix"
              title={showToken ? '隐藏 Token' : '显示 Token'}
              aria-label={showToken ? '隐藏 Token' : '显示 Token'}
              onClick={() => setShowToken((value) => !value)}
            >
              {showToken ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
          <span className="field-hint">需要 read_api 权限</span>
        </label>

      </div>

      {error ? (
        <div className="notice notice-error">
          <AlertIcon />
          <span>{error}</span>
        </div>
      ) : null}

      {test.kind === 'success' ? (
        <div className="notice notice-success">
          <CheckIcon />
          <span>已连接：@{test.user.username}</span>
        </div>
      ) : null}

      {test.kind === 'error' ? (
        <div className="notice notice-error">
          <AlertIcon />
          <span>{test.message}</span>
        </div>
      ) : null}

      <div className="connection-actions">
        <button
          type="button"
          className="btn"
          onClick={() => void handleTest()}
          disabled={test.kind === 'loading' || saving}
        >
          {test.kind === 'loading' ? <span className="spinner" /> : <PlugIcon />}
          测试连接
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="spinner" /> : <CheckIcon />}
          保存
        </button>
      </div>
    </form>
  );
}
