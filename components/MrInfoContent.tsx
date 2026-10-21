import { mrStateLabel } from '@/lib/format';
import type { MrInfo } from '@/lib/types';

interface MrInfoContentProps {
  info: MrInfo;
}

export function MrInfoContent({ info }: MrInfoContentProps) {
  return (
    <div className="mr-info">
      <div className="mr-info-head">
        <span className="mr-info-id">!{info.iid}</span>
        <span className="mr-info-state">{mrStateLabel(info.state)}</span>
      </div>
      {info.sourceBranch || info.targetBranch ? (
        <div className="mr-info-meta">
          {info.sourceBranch || '?'} → {info.targetBranch || '?'}
        </div>
      ) : null}
      {info.authorName ? <div className="mr-info-meta">@{info.authorName}</div> : null}
    </div>
  );
}
