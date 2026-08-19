'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { FeatureCard } from '@/components/FeatureCard';
import { SolutionDetailModal } from '@/components/SolutionDetailModal';
import { ProductDashboard } from '@/components/home/ProductDashboard';
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
    <section id="ana-sayfa" className="hero-section hero-accent relative scroll-section overflow-hidden py-14 sm:py-16 lg:py-20">
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="section-wrap relative grid min-w-0 items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          {/* Hero Technology Visual */}
          <div className="hero-tech-visual mb-6 flex items-center justify-center lg:justify-start">
            <Image
              src="/images/hero/technology-ecosystem-nobg.png"
              alt="TicketGo Teknoloji dijital yazılım ve entegrasyon ekosistemi"
              width={640}
              height={360}
              className="w-full max-w-[620px] object-contain drop-shadow-[0_0_48px_rgba(19,168,232,0.25)]"
              priority
            />
          </div>

          <p className="mb-4 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-brand-600 shadow-sm">
            Yazılım · SaaS · AI · CRM · API
          </p>
          <h1 className="max-w-xl text-[2rem] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[2.75rem] lg:text-[3.25rem] lg:leading-[1.12]">
            Yazılımı İşinizin Büyüme Motoruna Dönüştürüyoruz.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            CRM, SaaS, otomasyon, yapay zekâ entegrasyonları, veri platformları ve kurumsal yazılım çözümleriyle uçtan uca
            dijital ürünler geliştiriyoruz.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#cozumler" className="btn btn-primary">
              Çözümleri Keşfedin
            </Link>
            <Link href="/#iletisim" className="btn btn-secondary">
              Projenizi Konuşalım
            </Link>
          </div>
        </div>

        <div className="relative min-w-0">
          <ProductDashboard />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
