import { Bot, LifeBuoy, Ticket, Workflow, type LucideIcon } from 'lucide-react';
import type { SolutionDetail } from '@/data/solutions';
import type { PricedItem } from '@/lib/pricing';

export type OfferingVariant = 'product' | 'service' | 'maintenance';

const ICONS: Record<OfferingVariant, LucideIcon> = {
  product: Ticket,
  service: Workflow,
  maintenance: LifeBuoy,
};

const CATEGORIES: Record<OfferingVariant, string> = {
  product: 'Ürün',
  service: 'Hizmet',
  maintenance: 'Bakım',
};

export function offeringIcon(variant: OfferingVariant, category?: string): LucideIcon {
  if (category === 'ai') return Bot;
  return ICONS[variant];
}

export function offeringActionLabel(variant: OfferingVariant, purchasable: boolean, item: PricedItem): string {
  if (purchasable) return 'Satın Al';
  if (variant === 'service') return 'Teklif Al';
  if (variant === 'maintenance') return 'Bakım Talebi Oluştur';
  return item.ctaLabel.includes('Teklif') ? 'Teklif Al' : 'İletişime Geç';
}

export function pricedItemToDetail(
  item: PricedItem,
  variant: OfferingVariant,
  href: string,
  ctaLabel: string
): SolutionDetail {
  const Icon = offeringIcon(variant, item.category);
  return {
    id: item.id,
    category: CATEGORIES[variant],
    title: item.name,
    modalTitle: item.name,
    subtitle: item.headline,
    description: item.description,
    Icon,
    introLabel: '',
    hoverHints: item.features.slice(0, 3),
    hoverActionLabel: 'Detayları Gör →',
    featuresLabel: 'Neler Sunuyor?',
    features: item.features,
    useCasesLabel: 'Kapsam',
    useCases: item.includes,
    problemsLabel: 'Kapsam dışı',
    problems: item.excludes,
    benefitsLabel: variant === 'maintenance' ? 'Destek yaklaşımı' : 'Müşteri tarafı',
    benefits: item.customerResponsibilities,
    technicalApproach: [item.unit, item.delivery, item.revisionLimits].filter(Boolean).join(' · '),
    footerNote: item.cancellation,
    ctaHref: href,
    ctaLabel,
    contactType: item.contactType,
    ctaMessage: item.ctaMessage,
  };
}
