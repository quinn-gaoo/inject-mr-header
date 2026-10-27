export interface RedirectTarget {
  /** 规范化后的展示值，例如 https://www.api.com/api 或 www.api.com */
  display: string;
  host: string;
  scheme?: string;
  port?: string;
  /** 目标固定路径；不填时保留原请求路径。 */
  path?: string;
}

export type RedirectTargetResult =
  | { ok: true; target: RedirectTarget }
  | { ok: false; error: string };

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 把旧版普通域名迁移成等价的 URL 正则，匹配该域名及所有子域。 */
export function domainToUrlPattern(domain: string): string {
  const base = domain.trim().toLowerCase().replace(/\.+$/, '');
  if (!base) return '';
  return `^https?://([a-z0-9-]+\\.)*${escapeRegExp(base)}([/:?#]|$)`;
}

/**
 * DNR 使用 RE2，不支持 JS 的回溯引用和环视。这里提前拦截，
 * 避免出现“正则校验通过但 DNR 拒绝”的情况。
 */
export function validateRegexPattern(raw: string): string | null {
  const pattern = raw.trim();
  if (!pattern) return '请输入匹配正则';
  if (pattern.length > 2000) return '正则长度不能超过 2000 个字符';
  if (/\(\?<?[=!]/.test(pattern)) return '暂不支持环视（?=、?!、?<=、?<!）';
  if (/\(\?<[A-Za-z]/.test(pattern)) return '暂不支持命名分组';
  if (/\\[1-9]/.test(pattern)) return '匹配正则不支持反向引用';
  if (/\(\?[imsUx]/.test(pattern)) return '请直接使用不区分大小写的匹配，无需内联标志';
  try {
    new RegExp(pattern, 'i');
  } catch {
    return '正则格式不正确';
  }
  return null;
}

export function urlMatchesPattern(url: string, pattern: string): boolean {
  if (!url || !pattern.trim()) return false;
  try {
    return new RegExp(pattern, 'i').test(url);
  } catch {
    return false;
  }
}

/** 接受域名/Origin，也可以带一个固定路径；query 和 hash 不支持。 */
export function parseRedirectTarget(raw: string): RedirectTargetResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: '请输入目标域名' };

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: '目标域名格式不正确' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: '只支持 http/https 目标' };
  }
  if (url.username || url.password) {
    return { ok: false, error: '目标域名不能包含用户名或密码' };
  }
  if (url.search || url.hash) {
    return { ok: false, error: '目标不能包含 query 或 hash' };
  }

  const scheme = hasScheme ? url.protocol.slice(0, -1) : undefined;
  const host = url.hostname;
  const port = url.port || (hasScheme ? '' : undefined);
  const hostWithPort = `${host}${url.port ? `:${url.port}` : ''}`;
  const path = url.pathname && url.pathname !== '/' ? url.pathname : undefined;
  return {
    ok: true,
    target: {
      display: hasScheme
        ? `${scheme}://${hostWithPort}${path ?? ''}`
        : `${hostWithPort}${path ?? ''}`,
      host,
      ...(scheme ? { scheme } : {}),
      ...(port !== undefined ? { port } : {}),
      ...(path ? { path } : {}),
    },
  };
}
