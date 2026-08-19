'use client';

import Link from 'next/link';
import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { featuresByIds, overlayFeature } from '@/data/featureCatalog';

const hints: Record<string, string> = {
  frontend: '<ui />',
  backend: 'deploy()',
  data: '{ data }',
  cloud: 'ci/cd',
  devops: 'release',
  api: '<api />',
  ai: 'model()',
  security: 'rbac',
};

const items = featuresByIds(['frontend', 'backend', 'data', 'cloud', 'devops', 'api', 'ai', 'security']).map((item) => {
  if (item.id === 'ai') return overlayFeature('ai', { title: 'AI' }) ?? item;
  if (item.id === 'security') return overlayFeature('security', { title: 'Security' }) ?? item;
  return item;
});

export function TechnologiesSection() {
  return (
    <section className="section-muted">
      <div id="teknolojiler" className="section-wrap section-y scroll-section">
        <h2 className="section-title">Modern Teknoloji Ekosistemi</h2>
        <p className="section-subtitle">
          Teknoloji seçimini moda olan araca göre değil; güvenlik, bakım ve ölçek ihtiyacına göre yaparız.
        </p>
        <FeatureCardGrid
          items={items}
          className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          renderBadge={(item) => (
            <span className="font-mono text-[11px] text-brand-500">{hints[item.id]}</span>
          )}
          renderPreview={(item) => (
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {item.features.slice(0, 4).map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          )}
        />
        <Link href="/technologies" className="btn btn-secondary mt-8">
          Teknoloji yaklaşımını inceleyin
        </Link>
      </div>
    </section>
  );
}
