import type { BidLensApi } from '@bidlens/shared/types-only';

declare global {
  interface Window {
    bidlens: BidLensApi;
  }
}
