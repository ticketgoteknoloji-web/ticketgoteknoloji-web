'use client';

import { useCallback, useState } from 'react';
import { SolutionDetailModal } from '@/components/SolutionDetailModal';
import { OfferingCard, offeringGridClassName } from '@/components/pricing/OfferingCard';
import { useSelectableCards } from '@/hooks/useSelectableCards';
import { checkoutPeriodFor, isPurchasable, paymentUrl } from '@/lib/commerce';
import {
  offeringActionLabel,
  pricedItemToDetail,
  type OfferingVariant,
} from '@/lib/offering-detail';
import { quoteUrl, type BillingPeriod, type PricedItem } from '@/lib/pricing';

type OfferingGridProps = {
  items: PricedItem[];
  variant: OfferingVariant;
  period: BillingPeriod;
};

export function OfferingGrid({ items, variant, period }: OfferingGridProps) {
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);
  const cardSelection = useSelectableCards();
  const selectedItem = items.find((item) => item.id === cardSelection.selectedId) ?? null;
  const selected = selectedItem
    ? pricedItemToDetail(
        selectedItem,
        variant,
        isPurchasable(selectedItem.id)
          ? paymentUrl(selectedItem.id, checkoutPeriodFor(selectedItem.id, period))
          : quoteUrl(selectedItem.contactType, selectedItem.ctaMessage),
        offeringActionLabel(variant, isPurchasable(selectedItem.id), selectedItem)
      )
    : null;

  return (
    <>
      <div className={offeringGridClassName}>
        {items.map((item) => (
          <OfferingCard
            key={item.id}
            item={item}
            variant={variant}
            period={period}
            active={cardSelection.isActive(item.id)}
            hovered={cardSelection.isHovered(item.id)}
            open={open}
            onHover={cardSelection.onMouseEnter}
            onLeave={cardSelection.onMouseLeave}
            onSelect={(id) => {
              cardSelection.onSelect(id);
              setOpen(true);
            }}
          />
        ))}
      </div>
      <SolutionDetailModal open={open} solution={selected} onClose={closeModal} />
    </>
  );
}
