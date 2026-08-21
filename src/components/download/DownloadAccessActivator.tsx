'use client';

import { useEffect } from 'react';

/**
 * After verified paid checkout, claim HttpOnly download access cookie.
 * Token is the server-known order statusToken; claim API re-validates paid status.
 */
export function DownloadAccessActivator({ orderId, token }: { orderId: string; token: string }) {
  useEffect(() => {
    void fetch('/api/downloads/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, token }),
    });
  }, [orderId, token]);

  return null;
}
