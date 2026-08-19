'use client';

import { FeatureCard } from '@/components/FeatureCard';
import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { SolutionDetailModal } from '@/components/SolutionDetailModal';
import { overlayFeature } from '@/data/featureCatalog';
import { useSelectableCards } from '@/hooks/useSelectableCards';
import type { SolutionDetail } from '@/data/solutions';
import { useCallback, useState } from 'react';

const stack = [
  overlayFeature('frontend', { title: 'Frontend' }),
  overlayFeature('backend', { title: 'Backend' }),
  overlayFeature('data', { title: 'Veri' }),
  overlayFeature('cloud', { title: 'Cloud & DevOps' }),
  overlayFeature('api', { title: 'API & Entegrasyon' }),
  overlayFeature('security', { title: 'Güvenlik' }),
].filter((item): item is SolutionDetail => Boolean(item));

const architecture = [
  overlayFeature('web-mobile', { title: 'Web & Mobil' }),
  overlayFeature('crm', { title: 'CRM / Operasyon / Satış' }),
  overlayFeature('api', { title: 'API & Service Layer' }),
  overlayFeature('analytics', { title: 'Veri & Analitik' }),
  overlayFeature('ai', { title: 'AI Services' }),
  overlayFeature('arch-integrations', { title: 'Harici Entegrasyonlar' }),
].filter((item): item is SolutionDetail => Boolean(item));

const aiItem = overlayFeature('ai', {
  title: 'AI & Akıllı Sistemler',
  subtitle:
    'Aşağıdaki başlıklar, doğrulanmış tamamlanmış ürün listesi değil; geliştirebilir teknoloji alanları ve entegrasyon kabiliyetleridir.',
});

export function TechnologiesStackGrid() {
  return (
    <FeatureCardGrid
      items={stack}
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      hideSubtitle
      getAnchorId={(item) => item.id}
      getClassName={() => 'scroll-section'}
      renderPreview={(item) => (
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {item.features.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      )}
    />
  );
}

export function TechnologiesAiCard() {
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);
  const cardSelection = useSelectableCards();
  if (!aiItem) return null;

  return (
    <>
      <FeatureCard
        item={aiItem}
        className="p-8 md:p-10"
        active={cardSelection.isActive(aiItem.id)}
        hovered={cardSelection.isHovered(aiItem.id)}
        open={open}
        preview={
          <div className="mt-6 flex flex-wrap gap-2">
            {aiItem.features.map((entry) => (
              <span key={entry} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink">
                {entry}
              </span>
            ))}
          </div>
        }
        onHover={cardSelection.onMouseEnter}
        onLeave={cardSelection.onMouseLeave}
        onSelect={() => {
          cardSelection.onSelect(aiItem.id);
          setOpen(true);
        }}
      />
      <SolutionDetailModal open={open} solution={open ? aiItem : null} onClose={closeModal} />
    </>
  );
}

export function TechnologiesArchitecture() {
  return <FeatureCardGrid items={architecture} className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" compact />;
}
