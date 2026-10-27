export type DomainParseResult =
  | { ok: true; domain: string }
  | { ok: false; error: string };

/**
 * 把用户输入归一化成域名，仅用于旧版配置迁移和初始化。
 *
 * 支持：
 * - aaa.com / *.aaa.com / .aaa.com
 * - https://www.aaa.com/some/path
 * - www.aaa.com:8080（端口会被忽略，DNR 域名条件不区分端口）
 * - 中文域名（会转成 punycode）
 */
export function parseDomainInput(raw: string): DomainParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: '请输入域名' };

  let candidate = trimmed.toLowerCase();

  if (candidate.includes('://')) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return { ok: false, error: '域名格式不正确' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: '只支持 http/https 页面' };
    }
    candidate = url.hostname.replace(/^\*\./, '').replace(/^\.+/, '');
  } else {
    // 去掉路径、query、hash，只保留 host 部分
    candidate = candidate.split(/[/?#]/, 1)[0] ?? '';
    candidate = candidate.replace(/^\*\./, '').replace(/^\.+/, '');
    if (candidate.includes('*')) {
      return { ok: false, error: '只支持 *.example.com 这种通配写法，不支持中间通配' };
    }
    if (!candidate) return { ok: false, error: '请输入域名' };

    let url: URL;
    try {
      url = new URL(`http://${candidate}`);
    } catch {
      return { ok: false, error: '域名格式不正确' };
    }
    candidate = url.hostname;
  }

  candidate = candidate.replace(/\.+$/, '').toLowerCase();

  if (candidate.includes('*')) {
    return { ok: false, error: '只支持 *.example.com 这种通配写法，不支持中间通配' };
  }
  if (!candidate) return { ok: false, error: '请输入域名' };
  if (candidate.startsWith('[')) {
    return { ok: false, error: '暂不支持 IPv6 地址，请使用域名或 IPv4' };
  }
  if (candidate.includes('..')) {
    return { ok: false, error: '域名格式不正确' };
  }
  if (!/^[a-z0-9.-]+$/.test(candidate)) {
    return { ok: false, error: '域名只能包含字母、数字、短横线和点' };
  }

  return { ok: true, domain: candidate };
}

export function getHostname(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}
