import { AppError } from './errors';
import type {
  GitLabIdentity,
  MrListResult,
  MrOption,
  MrState,
  AppSettings,
} from './types';

const API_PREFIX = '/api/v4';
const REQUEST_TIMEOUT_MS = 20_000;

export const RESERVED_MR_QUERY_KEYS = new Set([
  'state',
  'per_page',
  'page',
  'order_by',
  'sort',
]);

type BaseUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** 归一化 GitLab 地址，允许带子路径和误粘贴的 /api/v4。 */
export function normalizeGitlabBaseUrl(raw: string): BaseUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: '请输入 GitLab 地址' };

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) withProtocol = `https://${withProtocol}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, error: 'GitLab 地址格式不正确' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'GitLab 地址必须是 http/https' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: '请不要把账号密码写在 URL 里，使用 Access Token' };
  }

  let pathname = parsed.pathname.replace(/\/+$/, '');
  pathname = pathname.replace(/\/api\/v4$/i, '');
  if (pathname === '/') pathname = '';

  return { ok: true, url: `${parsed.origin}${pathname}` };
}

export function normalizeProjectPath(raw: string, baseUrl?: string): string {
  let value = raw.trim();
  if (!value) return '';
  if (/^\d+$/.test(value)) return value;

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return value;
    }
  } else if (baseUrl) {
    const base = normalizeGitlabBaseUrl(baseUrl);
    if (base.ok) {
      try {
        const baseHost = new URL(base.url).host.toLowerCase();
        if (value.toLowerCase().startsWith(`${baseHost}/`)) {
          value = value.slice(baseHost.length);
        }
      } catch {
        // ignore
      }
    }
  }

  if (!value.startsWith('/')) value = `/${value}`;

  // 自建 GitLab 可能挂在 /gitlab 这类子路径下，粘贴完整 URL 时要把子路径去掉
  if (baseUrl) {
    const base = normalizeGitlabBaseUrl(baseUrl);
    if (base.ok) {
      const basePath = new URL(base.url).pathname.replace(/\/+$/, '');
      if (basePath && (value === basePath || value.startsWith(`${basePath}/`))) {
        value = value.slice(basePath.length);
      }
    }
  }

  value = value.split('/-/')[0] ?? value;
  value = value.replace(/^\/+|\/+$/g, '');
  value = value.replace(/\.git$/i, '');
  return value;
}

export function validateProjectPath(value: string): string | null {
  if (!value) return '请输入仓库路径';
  if (/^\d+$/.test(value)) return null;
  if (!/^[A-Za-z0-9_.\-/]+$/.test(value)) {
    return '仓库路径只能包含字母、数字、下划线、短横线、点和斜杠';
  }
  if (value.startsWith('/') || value.endsWith('/') || value.includes('//')) {
    return '仓库路径格式不正确';
  }
  return null;
}

/** 返回错误文案；合法时返回 null。 */
export function validateExtraQuery(raw: string): string | null {
  const value = raw.trim().replace(/^\?/, '');
  if (!value) return null;
  const params = new URLSearchParams(value);
  for (const key of params.keys()) {
    if (RESERVED_MR_QUERY_KEYS.has(key)) {
      return `高级参数里不能填 ${key}，请使用上方的“MR 状态 / 每页数量”`;
    }
  }
  return null;
}

export function buildMergeRequestQuery(input: {
  state: MrState;
  perPage: number;
  extraQuery?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (input.state !== 'all') params.set('state', input.state);
  const perPage = Math.min(100, Math.max(1, Math.round(input.perPage)));
  params.set('per_page', String(perPage));
  params.set('order_by', 'updated_at');
  params.set('sort', 'desc');

  const extra = new URLSearchParams((input.extraQuery ?? '').trim().replace(/^\?/, ''));
  for (const [key, value] of extra) {
    if (RESERVED_MR_QUERY_KEYS.has(key)) continue;
    params.append(key, value);
  }
  return params;
}

interface GitLabResponse<T> {
  data: T;
  headers: Headers;
}

async function gitlabRequest<T>(
  settings: AppSettings,
  path: string,
  params?: URLSearchParams,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<GitLabResponse<T>> {
  const base = normalizeGitlabBaseUrl(settings.gitlabBaseUrl);
  if (!base.ok) throw new AppError(base.error);

  const token = settings.token.trim();
  if (!token) throw new AppError('请先配置 GitLab Access Token');

  const url = new URL(`${base.url}${API_PREFIX}${path}`);
  if (params) {
    for (const [key, value] of params) url.searchParams.append(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'PRIVATE-TOKEN': token,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError('GitLab 请求超时，请检查网络或地址');
    }
    throw new AppError('无法连接 GitLab，请检查地址、网络或在浏览器中打开确认', String(error));
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new AppError(
      friendlyHttpError(response.status),
      await readErrorDetail(response),
    );
  }

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    throw new AppError('GitLab 返回的不是合法 JSON，请检查地址是否指向 GitLab 实例');
  }

  return { data, headers: response.headers };
}

function friendlyHttpError(status: number): string {
  if (status === 401) return 'Access Token 无效或已过期（401）';
  if (status === 403) return 'Token 权限不足，需要 read_api 权限（403）';
  if (status === 404) return 'GitLab 地址或仓库不存在（404），请检查地址和仓库路径';
  if (status === 429) return 'GitLab 请求过于频繁（429），请稍后再试';
  if (status >= 500) return `GitLab 服务端错误（${status}），请稍后再试`;
  return `GitLab 请求失败（${status}）`;
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      const json = JSON.parse(text) as { message?: unknown; error?: unknown };
      const message = json.message ?? json.error;
      if (typeof message === 'string') return message;
      if (message) return JSON.stringify(message).slice(0, 300);
    } catch {
      // 不是 JSON，按纯文本截断
    }
    return text.slice(0, 300);
  } catch {
    return undefined;
  }
}

export async function fetchCurrentUser(settings: AppSettings): Promise<GitLabIdentity> {
  const { data } = await gitlabRequest<unknown>(settings, '/user');
  if (!isRecord(data) || typeof data.username !== 'string') {
    throw new AppError('GitLab 返回的用户信息无法识别');
  }
  return {
    id: typeof data.id === 'number' ? data.id : 0,
    username: data.username,
    name: typeof data.name === 'string' ? data.name : data.username,
    webUrl: typeof data.web_url === 'string' ? data.web_url : '',
  };
}

export async function fetchMergeRequests(
  settings: AppSettings,
  input: {
    projectPath: string;
    state: MrState;
    perPage: number;
    extraQuery?: string;
  },
): Promise<MrListResult> {
  const project = normalizeProjectPath(input.projectPath, settings.gitlabBaseUrl);
  const projectError = validateProjectPath(project);
  if (projectError) throw new AppError(projectError);

  const params = buildMergeRequestQuery(input);
  const perPage = Number(params.get('per_page') ?? 100);

  const { data, headers } = await gitlabRequest<unknown>(
    settings,
    `/projects/${encodeURIComponent(project)}/merge_requests`,
    params,
  );

  if (!Array.isArray(data)) {
    throw new AppError('GitLab 返回的 MR 列表格式无法识别');
  }

  const items = data
    .map(toMrOption)
    .filter((item): item is MrOption => item !== null)
    // 缓存和 UI 都按 MR 编号从高到低排列
    .sort((a, b) => b.iid - a.iid);

  const totalHeader = headers.get('x-total');
  const total = totalHeader && /^\d+$/.test(totalHeader) ? Number(totalHeader) : null;
  const nextPage = headers.get('x-next-page');

  return {
    items,
    hasMore: Boolean(nextPage) || items.length >= perPage,
    total,
  };
}

function toMrOption(raw: unknown): MrOption | null {
  if (!isRecord(raw)) return null;
  const iid = raw.iid;
  if (typeof iid !== 'number' || !Number.isFinite(iid) || iid <= 0) return null;

  const author = isRecord(raw.author) ? raw.author : null;
  const title = typeof raw.title === 'string' ? raw.title : `!${iid}`;

  return {
    iid,
    title,
    state: typeof raw.state === 'string' ? raw.state : 'opened',
    draft: raw.draft === true || /^\s*draft:/i.test(title),
    webUrl: typeof raw.web_url === 'string' ? raw.web_url : '',
    sourceBranch: typeof raw.source_branch === 'string' ? raw.source_branch : '',
    targetBranch: typeof raw.target_branch === 'string' ? raw.target_branch : '',
    authorName:
      author && typeof author.name === 'string'
        ? author.name
        : author && typeof author.username === 'string'
          ? author.username
          : '',
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
