'use client';

import { aiSolutions } from '@/data/aiSolutions';
import { SolutionGrid } from '@/components/home/SolutionGrid';

export function AiSolutionsSection() {
  return (
    <SolutionGrid
      id="yapay-zeka"
      title="AI-Ready Dijital Sistemler"
      subtitle="Yapay zekâyı bağımsız bir özellik olarak değil, ürün ve operasyon katmanlarını güçlendiren bir servis olarak ele alıyoruz."
      items={aiSolutions}
      columnsClassName="md:grid-cols-2 xl:grid-cols-3"
      tone="dark"
    />
  );
}
