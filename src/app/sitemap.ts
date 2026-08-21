import type { MetadataRoute } from 'next';
import { BRAND_SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '/',
    '/about',
    '/solutions',
    '/pricing',
    '/technologies',
    '/projects',
    '/download',
    '/contact',
    '/privacy',
    '/kvkk',
    '/terms',
    '/cookies',
    '/legal/distance-sales',
    '/legal/pre-information',
    '/legal/refund',
  ];
  return routes.map((route) => ({
    url: `${BRAND_SITE_URL}${route}`,
    changeFrequency: 'monthly',
    priority: route === '/' ? 1 : 0.8,
  }));
}
