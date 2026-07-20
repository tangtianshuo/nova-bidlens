export type ReviewMode = 'risk-review' | 'version-diff';

export interface ReviewModeConfig {
  mode: ReviewMode;
  showFormatTabs: boolean;
  showCommentTab: boolean;
  showRevisionTab: boolean;
  showEvidencePanel: boolean;
  showFindingNav: boolean;
}

export function getReviewModeConfig(mode: ReviewMode): ReviewModeConfig {
  switch (mode) {
    case 'risk-review':
      return {
        mode,
        showFormatTabs: false,
        showCommentTab: false,
        showRevisionTab: false,
        showEvidencePanel: true,
        showFindingNav: true,
      };
    case 'version-diff':
      return {
        mode,
        showFormatTabs: true,
        showCommentTab: true,
        showRevisionTab: true,
        showEvidencePanel: false,
        showFindingNav: false,
      };
  }
}
