'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FeatureCard } from '@/components/FeatureCard';
import { SolutionDetailModal } from '@/components/SolutionDetailModal';
import { ProductDashboard } from '@/components/home/ProductDashboard';
import { HeroTechVisual } from '@/components/home/HeroTechVisual';
import { featuresByIds } from '@/data/featureCatalog';
import { useSelectableCards } from '@/hooks/useSelectableCards';

const heroModules = featuresByIds(['crm', 'operations', 'analytics', 'api']);

export function HeroSection() {
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);
  const cardSelection = useSelectableCards();
  const { onSelect } = cardSelection;
  const selected = heroModules.find((item) => item.id === cardSelection.selectedId) ?? null;

  useEffect(() => {
    const feature = new URLSearchParams(window.location.search).get('feature');
    if (!feature || !heroModules.some((item) => item.id === feature)) return;
    onSelect(feature);
    setOpen(true);
  }, [onSelect]);

  return (
    <section id="ana-sayfa" className="hero-section hero-accent relative scroll-section overflow-x-clip py-14 sm:py-16 lg:py-20">
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="section-wrap relative grid min-w-0 items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0 max-w-full">
          {/* Hero Technology Visual — spin + data-flow pulses */}
          <HeroTechVisual />

          <h1 className="max-w-xl break-words text-[2rem] font-bold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[2.75rem] lg:text-[3.25rem] lg:leading-[1.1]">
            TicketGo Teknoloji A.Ş.
          </h1>
          <p className="mt-5 max-w-[68ch] text-[0.9375rem] font-normal leading-[1.7] text-muted sm:text-lg sm:leading-[1.7]">
            Kurumsal yazılım, SaaS, CRM, yapay zekâ ve entegrasyon çözümlerini; ölçeklenebilir mimari, yüksek güvenlik ve
            sürdürülebilir teknoloji yaklaşımıyla tasarlıyor, geliştiriyor ve işletiyoruz.
          </p>
          <p className="mt-4 max-w-[68ch] text-[0.9375rem] font-normal leading-[1.7] text-muted sm:text-lg sm:leading-[1.7]">
            İş süreçlerini dijitalleştiren, operasyonel verimliliği artıran ve kurumların büyüme hedeflerini destekleyen
            uçtan uca teknoloji çözümleri sunuyoruz.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/#cozumler" className="btn btn-primary w-full justify-center sm:w-auto">
              Çözümleri Keşfedin
            </Link>
            <Link href="/#iletisim" className="btn btn-secondary w-full justify-center sm:w-auto">
              Projenizi Konuşalım
            </Link>
          </div>
        </div>

        <div className="relative min-w-0 max-w-full">
          <ProductDashboard />
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            {heroModules.map((item) => (
              <FeatureCard
                key={item.id}
                item={item}
                compact
                active={cardSelection.isActive(item.id)}
                hovered={cardSelection.isHovered(item.id)}
                open={open}
                onHover={cardSelection.onMouseEnter}
                onLeave={cardSelection.onMouseLeave}
                onSelect={(id) => {
                  onSelect(id);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <SolutionDetailModal open={open} solution={selected} onClose={closeModal} />
    </section>
  );
}
