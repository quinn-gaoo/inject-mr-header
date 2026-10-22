import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { AlertIcon, CloseIcon } from '@/components/icons';
import { PageMrTagPicker } from '@/components/PageMrTagPicker';
import { Switch } from '@/components/Switch';
import { isExtensionContextInvalidated } from '@/lib/contextError';
import { describeError } from '@/lib/errors';
import { selectedMrFromOption } from '@/lib/format';
import { hostMatchesDomain } from '@/lib/domain';
import { mutateRules, readRules, readSettings } from '@/lib/storage';
import type { AppSettings, InjectionRule, MrOption } from '@/lib/types';
import { useHoverClose } from '@/lib/useHoverClose';

interface PanelData {
  settings: AppSettings;
  rules: InjectionRule[];
}

interface PagePanelProps {
  host: HTMLElement;
}

export function PagePanel({ host }: PagePanelProps) {
  const [data, setData] = useState<PanelData | null>(null);
  const [open, setOpen] = useState(false);
  const [invalidated, setInvalidated] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadId = useRef(0);
  const { cancel, schedule } = useHoverClose();

  const reload = useCallback(async () => {
    const id = loadId.current + 1;
    loadId.current = id;
    try {
      const [settings, rules] = await Promise.all([readSettings(), readRules()]);
      if (loadId.current !== id) return;
      setData({ settings, rules });
    } catch (cause) {
      if (isExtensionContextInvalidated(cause)) setInvalidated(true);
    }
  }, []);

  useEffect(() => {
    void reload();
    const handler = (_changes: Record<string, unknown>, areaName: string) => {
      if (areaName === 'local') void reload();
    };
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }, [reload]);

  useEffect(() => {
    if (invalidated) return;
    const timer = window.setInterval(() => {
      try {
        if (!browser.runtime?.id) setInvalidated(true);
      } catch {
        setInvalidated(true);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [invalidated]);

  useEffect(() => {
    if (invalidated) setOpen(true);
  }, [invalidated]);

  const pageHost = window.location.hostname.toLowerCase();
  // 只要域名匹配到规则就保留悬浮窗口，不受规则启停影响；全局关闭只由 options 的悬浮窗口开关控制。
  const matchedRules =
    data && data.settings.pageOverlayEnabled
      ? data.rules
          .filter((rule) => hostMatchesDomain(pageHost, rule.domain))
          .sort((a, b) => b.domain.length - a.domain.length)
      : [];
  const visible = Boolean(data && matchedRules.length > 0);

  useEffect(() => {
    host.style.display = visible ? 'block' : 'none';
    if (!visible && open) setOpen(false);
  }, [host, visible, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.composedPath().includes(host)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, host]);

  if (!data || !visible) return null;

  const handleSelect = async (rule: InjectionRule, option: MrOption | null) => {
    setActionError(null);
    try {
      await mutateRules((rules) => {
        const target = rules.find((item) => item.id === rule.id);
        if (!target) return;
        target.selectedMr = option
          ? selectedMrFromOption(option, target.projectPath)
          : null;
        target.updatedAt = Date.now();
      });
    } catch (cause) {
      if (isExtensionContextInvalidated(cause)) {
        setInvalidated(true);
        return;
      }
      setActionError(describeError(cause));
    }
  };

  const handleToggle = async (rule: InjectionRule, enabled: boolean) => {
    setActionError(null);
    try {
      await mutateRules((rules) => {
        const target = rules.find((item) => item.id === rule.id);
        if (!target) return;
        target.enabled = enabled;
        target.updatedAt = Date.now();
      });
    } catch (cause) {
      if (isExtensionContextInvalidated(cause)) {
        setInvalidated(true);
        return;
      }
      setActionError(describeError(cause));
    }
  };

  const close = () => setOpen(false);

  return (
    <div className="mrh-root">
      <button
        type="button"
        className={`mrh-dot${open ? ' is-open' : ''}`}
        aria-label="打开 MR Header 选择面板"
        aria-expanded={open}
        title="MR Header"
        onMouseEnter={() => {
          cancel();
          setOpen(true);
        }}
        onMouseLeave={() => schedule(close)}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen((value) => !value)}
      />

      {open ? (
        <div
          className="mrh-panel"
          role="dialog"
          aria-label="MR Header"
          onMouseEnter={cancel}
          onMouseLeave={() => schedule(close)}
        >
          <div className="mrh-head">
            <div className="mrh-brand-mark" aria-hidden="true">
              MR
            </div>
            <div className="mrh-brand">
              <div className="mrh-brand-title">MR Header</div>
              <div className="mrh-brand-host" title={pageHost}>
                {pageHost}
              </div>
            </div>
            <button
              type="button"
              className="mrh-close"
              aria-label="关闭"
              onClick={() => setOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mrh-body">
            {invalidated ? (
              <div className="mrh-notice is-error">
                <AlertIcon />
                <span>扩展已更新，请刷新页面后继续。</span>
                <button
                  type="button"
                  className="mrh-link"
                  onClick={() => window.location.reload()}
                >
                  刷新页面
                </button>
              </div>
            ) : (
              <>
                {actionError ? (
                  <div className="mrh-notice is-error">
                    <AlertIcon />
                    <span>{actionError}</span>
                  </div>
                ) : null}

                <div className="mrh-rules">
                  {matchedRules.map((rule) => (
                    <section className="mrh-rule" key={rule.id}>
                      <div className="mrh-rule-head">
                        <span className="mrh-tag">{rule.headerName}</span>
                        <span className="mrh-rule-switch">
                          <Switch
                            checked={rule.enabled}
                            onChange={(enabled) => void handleToggle(rule, enabled)}
                            label={`${rule.domain || '规则'} 启用开关`}
                            size="sm"
                          />
                        </span>
                      </div>
                      <PageMrTagPicker
                        rule={rule}
                        settings={data.settings}
                        onSelect={(mr) => void handleSelect(rule, mr)}
                        onInvalidated={() => setInvalidated(true)}
                      />
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
