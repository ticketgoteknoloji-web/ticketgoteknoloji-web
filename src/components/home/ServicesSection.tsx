'use client';

import { solutionCatalog } from '@/data/solutionCatalog';
import { SolutionGrid } from '@/components/home/SolutionGrid';

type ServicesSectionProps = {
  headingAs?: 'h1' | 'h2';
};

export function ServicesSection({ headingAs = 'h2' }: ServicesSectionProps) {
  return (
    <SolutionGrid
      id="cozumler"
      title="Çözümler"
      subtitle="Kurumsal yazılım, CRM, SaaS, rezervasyon, operasyon, web/mobil, API, otomasyon ve yapay zekâ entegrasyonlarını işletmenizin sürecine göre tasarlıyoruz."
      items={solutionCatalog}
      headingAs={headingAs}
    />
  );
}
