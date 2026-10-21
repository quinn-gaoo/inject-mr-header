export class AppError extends Error {
  constructor(
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function describeError(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '请求超时，请检查网络或稍后重试';
  }
  if (error instanceof TypeError) {
    return '无法连接服务，请检查地址、网络或证书';
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
