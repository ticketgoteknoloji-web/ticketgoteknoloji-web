import type { MetadataRoute } from 'next';
import { BRAND_SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/payment',
        '/payment/',
        '/api/',
        '/api/downloads/',
        '/api/payments/',
      ],
    },
    sitemap: `${BRAND_SITE_URL}/sitemap.xml`,
    host: BRAND_SITE_URL,
  };
}
