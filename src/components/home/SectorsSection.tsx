'use client';

import { useState } from 'react';
import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { sectorSolutions } from '@/data/sectors';

const PREVIEW_COUNT = 8;

export function SectorsSection() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? sectorSolutions : sectorSolutions.slice(0, PREVIEW_COUNT);

  return (
    <section id="sektorler" className="section-muted scroll-section">
      <div className="section-wrap section-y">
        <h2 className="section-title">Teknolojiyi farklı sektörlerin ihtiyaçlarına uyarlıyoruz</h2>
        <p className="section-subtitle">
          Her sektörün operasyonu, müşterisi ve dijitalleşme ihtiyacı farklıdır. TicketGo Teknoloji; modern yazılım
          mimarilerini sektörlerin iş süreçlerine uyarlayarak ihtiyaca özel dijital platformlar geliştirebilecek teknoloji
          altyapıları tasarlar.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          Aşağıdaki alanlar, çözüm geliştirebildiğimiz sektörel kullanım senaryolarını temsil eder.
        </p>
        <FeatureCardGrid items={visible} className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
        {!expanded ? (
          <button type="button" onClick={() => setExpanded(true)} className="btn btn-secondary mt-8">
            Tüm sektörleri gör
          </button>
        ) : null}
      </div>
    </section>
  );
}
