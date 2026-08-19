'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { FeatureCard } from '@/components/FeatureCard';
import { SolutionDetailModal } from '@/components/SolutionDetailModal';
import type { SolutionDetail } from '@/data/solutions';
import { useSelectableCards } from '@/hooks/useSelectableCards';

type FeatureCardGridProps = {
  items: SolutionDetail[];
  className?: string;
  compact?: boolean;
  hideSubtitle?: boolean;
  getClassName?: (item: SolutionDetail) => string;
  renderPreview?: (item: SolutionDetail) => ReactNode;
  renderBadge?: (item: SolutionDetail) => ReactNode;
  getAnchorId?: (item: SolutionDetail) => string | undefined;
  initialOpenId?: string | null;
};

export function FeatureCardGrid({
  items,
  className = 'mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4',
  compact,
  hideSubtitle,
  getClassName,
  renderPreview,
  renderBadge,
  getAnchorId,
  initialOpenId = null,
}: FeatureCardGridProps) {
  const [open, setOpen] = useState(Boolean(initialOpenId));
  const closeModal = useCallback(() => setOpen(false), []);
  const cardSelection = useSelectableCards(initialOpenId);
  const selected = items.find((item) => item.id === cardSelection.selectedId) ?? null;

  return (
    <>
      <div className={className}>
        {items.map((item) => (
          <FeatureCard
            key={item.id}
            item={item}
            compact={compact}
            hideSubtitle={hideSubtitle || Boolean(renderPreview)}
            className={getClassName?.(item)}
            badge={renderBadge?.(item)}
            preview={renderPreview?.(item)}
            anchorId={getAnchorId?.(item)}
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
