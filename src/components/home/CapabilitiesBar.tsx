'use client';

import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { featuresByIds, overlayFeature } from '@/data/featureCatalog';

const spans: Record<string, string> = {
  software: 'md:col-span-2 md:row-span-2',
  ai: 'md:col-span-2',
};

const items = featuresByIds(['software', 'ai', 'crm', 'api', 'analytics', 'cloud']).map((item) => {
  if (item.id === 'crm') return overlayFeature('crm', { title: 'CRM' }) ?? item;
  if (item.id === 'api') return overlayFeature('api', { title: 'API' }) ?? item;
  if (item.id === 'analytics') return overlayFeature('analytics', { title: 'Analytics' }) ?? item;
  return item;
});

export function CapabilitiesBar() {
  return (
    <section className="section-muted">
      <div className="section-wrap section-y">
        <h2 className="section-title">Teknoloji Kabiliyetleri</h2>
        <p className="section-subtitle">
          Yazılım, veri, entegrasyon ve yapay zekâyı aynı ürün ekosisteminde birleştiriyoruz.
        </p>
        <FeatureCardGrid
          items={items}
          className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          getClassName={(item) => spans[item.id] ?? ''}
        />
      </div>
    </section>
  );
}
