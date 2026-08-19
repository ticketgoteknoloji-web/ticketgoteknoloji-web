'use client';

import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { platformSolutions } from '@/data/solutions';

export function SolutionsSection() {
  return (
    <section id="urunler" className="section-wrap section-y scroll-section">
      <h2 className="section-title">Geliştirebildiğimiz Platformlar</h2>
      <p className="section-subtitle">
        Aşağıdaki başlıklar, tamamlanmış referans olarak değil; kurumlar için tasarladığımız çözüm yaklaşımlarını temsil eder.
      </p>
      <FeatureCardGrid
        items={platformSolutions.map((item) => ({ ...item, category: item.category ?? 'Platform' }))}
        className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      />
    </section>
  );
}
