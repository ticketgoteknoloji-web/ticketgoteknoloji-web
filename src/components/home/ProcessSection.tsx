'use client';

import { useCallback, useEffect, useState } from 'react';
import { FeatureCard } from '@/components/FeatureCard';
import { SolutionDetailModal } from '@/components/SolutionDetailModal';
import { processSteps, processTimeline } from '@/data/processSteps';
import { useSelectableCards } from '@/hooks/useSelectableCards';

export function ProcessSection() {
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);
  const cardSelection = useSelectableCards();
  const { onSelect } = cardSelection;
  const selected = processSteps.find((item) => item.id === cardSelection.selectedId) ?? null;

  useEffect(() => {
    const process = new URLSearchParams(window.location.search).get('process');
    if (!process || !processSteps.some((item) => item.id === process)) return;
    onSelect(process);
    setOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById('nasil-calisiyoruz')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [onSelect]);

  const openStep = (id: string) => {
    onSelect(id);
    setOpen(true);
  };

  return (
    <section id="nasil-calisiyoruz" className="section-wrap section-y scroll-section">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Nasıl Çalışıyoruz?</p>
      <h2 className="section-title">Fikirden Çalışan Dijital Ürüne</h2>
      <p className="section-subtitle">
        Her projeyi iş ihtiyacını anlamaktan sürdürülebilir teknoloji altyapısına kadar uçtan uca ele alıyoruz.
      </p>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
        TicketGo Teknoloji olarak projeleri yalnızca kodlama süreci olarak görmüyoruz. İş hedefini, kullanıcı ihtiyacını,
        teknik gereksinimleri ve uzun vadeli ölçeklenebilirliği birlikte değerlendirerek analizden yayına kadar kontrollü bir
        geliştirme süreci yürütüyoruz.
      </p>

      <ol className="relative mt-10 grid gap-4 md:grid-cols-3">
        <span className="pointer-events-none absolute left-6 right-6 top-[1.15rem] hidden h-px bg-line md:block" aria-hidden />
        {processSteps.map((item, index) => (
          <li key={item.id} className="relative min-w-0">
            <FeatureCard
              item={item}
              active={cardSelection.isActive(item.id)}
              hovered={cardSelection.isHovered(item.id)}
              open={open}
              badge={
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-brand-200 bg-brand-50 px-2 text-xs font-semibold text-brand-700">
                  {String(index + 1).padStart(2, '0')}
                </span>
              }
              onHover={cardSelection.onMouseEnter}
              onLeave={cardSelection.onMouseLeave}
              onSelect={openStep}
            />
          </li>
        ))}
      </ol>

      <nav aria-label="Uçtan uca süreç" className="mt-12">
        <ol className="flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center md:justify-center">
          {processTimeline.map((entry, index) => (
            <li key={entry.id} className="flex flex-col items-center md:flex-row">
              <button
                type="button"
                aria-pressed={cardSelection.isActive(entry.id)}
                aria-haspopup="dialog"
                data-active={cardSelection.isActive(entry.id)}
                data-hovered={cardSelection.isHovered(entry.id)}
                onMouseEnter={() => cardSelection.onMouseEnter(entry.id)}
                onMouseLeave={() => cardSelection.onMouseLeave(entry.id)}
                onClick={() => openStep(entry.id)}
                className="selectable-card w-full rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink md:w-auto"
              >
                {entry.label}
              </button>
              {index < processTimeline.length - 1 ? (
                <span className="py-1 text-brand-500 md:px-2 md:py-0" aria-hidden>
                  <span className="md:hidden">↓</span>
                  <span className="hidden md:inline">→</span>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>

      <SolutionDetailModal open={open} solution={selected} onClose={closeModal} />
    </section>
  );
}
