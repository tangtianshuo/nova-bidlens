import type { BidLensApi } from '@bidlens/shared';

declare global {
  interface Window {
    bidlens: BidLensApi;
  }
}
