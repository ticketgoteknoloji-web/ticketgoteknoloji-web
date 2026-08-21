import type { DownloadPlatformId } from '@/data/downloads';

export type DownloadPackageStatus = 'published' | 'unpublished';

/**
 * Persisted download package — created only after a successful admin upload.
 * Never seed fake rows into this store.
 */
export type StoredDownloadPackage = {
  id: string;
  /** Payment catalog product id (single source for checkout). */
  productId: string;
  name: string;
  description: string;
  /** Multi-platform support — one record may apply to several OS targets. */
  platforms: DownloadPlatformId[];
  /**
   * Human-readable platform label (derived from `platforms` for search / legacy).
   * Prefer `platforms` for filtering and UI badges.
   */
  platform: string;
  version: string;
  architecture: string;
  fileType: string;
  mimeType: string;
  fileSize: string;
  fileSizeBytes: number;
  /** USD (or currency) price. 0 = free. null = not for sale / undefined. */
  priceUsd: number | null;
  currency: string;
  storedFileName: string;
  originalFileName: string;
  /** Relative stored filename only — never expose absolute paths to clients. */
  storageRelativePath: string;
  checksumSha256: string;
  uploadedAt: string;
  uploadedBy: string;
  published: boolean;
  status: DownloadPackageStatus;
};

export type DownloadEntitlement = {
  id: string;
  orderId: string;
  productId: string;
  paymentId: string | null;
  paymentStatus: 'paid';
  downloadGranted: true;
  status: 'active' | 'revoked';
  statusToken: string;
  customerEmail: string;
  grantedAt: string;
  expiresAt: string | null;
};

export type DownloadsDb = {
  packages: StoredDownloadPackage[];
  entitlements: DownloadEntitlement[];
  audit: Array<{
    id: string;
    event: string;
    productId?: string;
    fileName?: string;
    fileSize?: number;
    admin?: string;
    createdAt: string;
  }>;
};

/** Public list payload (no storage paths / server filenames). */
export type PublicDownloadPackage = {
  id: string;
  productId: string;
  name: string;
  description: string;
  platforms: DownloadPlatformId[];
  /** Joined label for search; UI should prefer `platforms` badges. */
  platform: string;
  version: string;
  architecture: string;
  fileType: string;
  fileSize: string;
  uploadedAt: string;
  priceUsd: number | null;
  currency: string;
  checksumSha256: string;
  fileAvailable: boolean;
  /** true when priced > 0 and file available */
  purchasable: boolean;
  /** true when price is exactly 0 */
  free: boolean;
};

export type DownloadAccessState =
  | 'no_file'
  | 'unpublished'
  | 'price_undefined'
  | 'purchase_required'
  | 'payment_pending'
  | 'payment_failed'
  | 'download_ready'
  | 'expired';
