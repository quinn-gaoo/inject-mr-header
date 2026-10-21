/** 扩展被 reload/更新后，旧 content script 里的 API 调用会抛这些错误。 */
export function isExtensionContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Extension context invalidated|Receiving end does not exist|message port closed/i.test(
    message,
  );
}
