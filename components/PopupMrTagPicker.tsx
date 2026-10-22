import type { AppSettings, InjectionRule, MrOption } from '@/lib/types';
import { useMrOptions } from '@/lib/useMrOptions';
import { MrTagPicker } from './MrTagPicker';
import { TippyMrTag } from './TippyMrTag';

interface PopupMrTagPickerProps {
  rule: InjectionRule;
  settings: AppSettings;
  onSelect: (mr: MrOption | null) => void;
}

/** popup 里的 MR 选择区，直接使用 extension page 的缓存与网络能力。 */
export function PopupMrTagPicker({
  rule,
  settings,
  onSelect,
}: PopupMrTagPickerProps) {
  const { result, loading, error, configured, refresh } = useMrOptions(
    settings,
    rule,
    rule.enabled,
  );

  const selectedMr =
    rule.selectedMr && rule.selectedMr.projectPath === rule.projectPath
      ? rule.selectedMr
      : null;

  return (
    <MrTagPicker
      selectedMr={selectedMr}
      items={result?.items ?? []}
      loading={loading}
      error={error}
      configured={configured}
      repo={rule.projectPath}
      onSelect={onSelect}
      onRefresh={() => void refresh()}
      details="none"
      TagComponent={TippyMrTag}
    />
  );
}
