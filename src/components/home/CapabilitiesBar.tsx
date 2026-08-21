'use client';

import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { featuresByIds, overlayFeature } from '@/data/featureCatalog';

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
          hideSubtitle
          className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4"
        />
      </div>
    </section>
  );
}
