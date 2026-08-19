'use client';

import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import type { SolutionDetail } from '@/data/solutions';

type SolutionGridProps = {
  id?: string;
  title: string;
  subtitle: string;
  items: SolutionDetail[];
  columnsClassName?: string;
  headingAs?: 'h1' | 'h2';
  tone?: 'light' | 'dark';
};

export function SolutionGrid({
  id,
  title,
  subtitle,
  items,
  columnsClassName = 'md:grid-cols-2 xl:grid-cols-4',
  headingAs = 'h2',
  tone = 'light',
}: SolutionGridProps) {
  const Heading = headingAs;

  return (
    <section className={tone === 'dark' ? 'section-muted' : undefined}>
      <div id={id} className="section-wrap section-y scroll-section">
        <Heading className="section-title">{title}</Heading>
        <p className="section-subtitle">{subtitle}</p>
        <FeatureCardGrid
          items={items.map((item) => ({ ...item, category: item.category ?? 'Çözüm' }))}
          className={`mt-10 grid gap-5 ${columnsClassName}`}
        />
      </div>
    </section>
  );
}
