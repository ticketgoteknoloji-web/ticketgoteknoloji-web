'use client';

import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { featuresByIds, overlayFeature } from '@/data/featureCatalog';

const items = [
  featuresByIds(['why-modular'])[0],
  overlayFeature('security', { title: 'Security First' }),
  featuresByIds(['why-api'])[0],
  overlayFeature('cloud', { title: 'Cloud Ready' }),
  overlayFeature('ai', { title: 'AI Ready', subtitle: 'Sistemleri, ihtiyaç halinde yapay zekâ servisleriyle genişletilebilecek şekilde kurgularız.' }),
  featuresByIds(['why-data'])[0],
].filter((item): item is NonNullable<typeof item> => Boolean(item));

const spans: Record<string, string> = {
  'why-modular': 'md:col-span-2',
  'why-data': 'md:col-span-2',
};

export function WhyTicketGoSection() {
  return (
    <section className="section-wrap section-y">
      <h2 className="section-title">Neden TicketGo Teknoloji?</h2>
      <p className="section-subtitle">
        Teknolojiyi tek başına yazılım üretmek olarak değil; iş sürecini sadeleştiren, ölçülebilir ve sürdürülebilir bir
        ürün olarak ele alırız.
      </p>
      <FeatureCardGrid
        items={items}
        className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        getClassName={(item) => spans[item.id] ?? ''}
      />
    </section>
  );
}
