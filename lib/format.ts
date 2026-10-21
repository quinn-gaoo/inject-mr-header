import type { MrOption, SelectedMr } from './types';

export function mrStateLabel(state: string): string {
  switch (state) {
    case 'opened':
      return 'Open';
    case 'merged':
      return 'Merged';
    case 'closed':
      return 'Closed';
    case 'locked':
      return 'Locked';
    default:
      return state || '未知';
  }
}

export function selectedMrToOption(mr: SelectedMr): MrOption {
  return {
    iid: mr.iid,
    title: mr.title,
    state: mr.state,
    draft: false,
    webUrl: mr.webUrl,
    sourceBranch: mr.sourceBranch ?? '',
    targetBranch: mr.targetBranch ?? '',
    authorName: mr.authorName ?? '',
    updatedAt: '',
  };
}

export function selectedMrFromOption(mr: MrOption, projectPath: string): SelectedMr {
  return {
    iid: mr.iid,
    title: mr.title,
    state: mr.state,
    webUrl: mr.webUrl,
    sourceBranch: mr.sourceBranch,
    targetBranch: mr.targetBranch,
    authorName: mr.authorName,
    projectPath,
    selectedAt: Date.now(),
  };
}

