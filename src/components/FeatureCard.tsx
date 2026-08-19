'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import type { SolutionDetail } from '@/data/solutions';

type FeatureCardProps = {
  item: SolutionDetail;
  active?: boolean;
  hovered?: boolean;
  open?: boolean;
  compact?: boolean;
  pill?: boolean;
  hideSubtitle?: boolean;
  className?: string;
  badge?: ReactNode;
  preview?: ReactNode;
  anchorId?: string;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
};

export function FeatureCard({
  item,
  active,
  hovered,
  open,
  compact,
  pill,
  hideSubtitle,
  className = '',
  badge,
  preview,
  anchorId,
  onSelect,
  onHover,
  onLeave,
}: FeatureCardProps) {
  const hints = (item.hoverHints ?? item.features).slice(0, 3);
  const hasImage = Boolean(item.cardImage) && !pill && !compact;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-expanded={Boolean(open && active)}
      aria-haspopup="dialog"
      aria-label={`${item.title}. ${item.hoverActionLabel ?? 'Detayları gör'}`}
      data-active={active}
      data-hovered={hovered}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onLeave(item.id)}
      onClick={() => onSelect(item.id)}
      id={anchorId}
      className={`selectable-card group relative flex h-full min-w-0 cursor-pointer flex-col border border-line bg-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        pill
          ? 'rounded-xl px-4 py-2.5'
          : compact
            ? 'rounded-xl p-3.5 shadow-soft'
            : 'overflow-hidden rounded-2xl shadow-soft'
      } ${className}`}
    >
      {/* Card image — top area, 16:9 */}
      {hasImage ? (
        <div className="relative w-full shrink-0 overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <Image
            src={item.cardImage!}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04] group-data-[hovered=true]:scale-[1.04]"
          />
          {/* subtle gradient at bottom of image for blending into content */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.6))' }}
          />
        </div>
      ) : null}

      {/* Decorative accent background — only when no card image */}
      {!pill && !hasImage && item.cardAccent ? (
        <span className={`card-accent-layer ${item.cardAccent}`} aria-hidden="true" />
      ) : null}

      {pill ? (
        <span className="selectable-card-title text-sm font-medium text-ink">{item.title}</span>
      ) : (
        <div className={`flex flex-1 flex-col ${hasImage ? 'p-5' : 'p-5'}`}>
          <div className="flex items-start justify-between gap-3">
            <item.Icon className="selectable-card-icon text-brand-500" size={compact ? 18 : 20} />
            {badge}
          </div>
          <h3 className={`selectable-card-title font-semibold text-ink ${compact ? 'mt-2 text-[13px]' : 'mt-3 text-xl'}`}>
            {item.title}
          </h3>
          {compact || hideSubtitle ? null : <p className="mt-2 flex-1 text-sm leading-6 text-muted">{item.subtitle}</p>}
          {preview}
          <div className={`mt-auto ${compact ? 'min-h-[1.25rem] pt-2' : 'pt-4'}`}>
            {Boolean(preview) || !hints.length ? null : (
              <ul className={`mb-2 hidden flex-wrap gap-1 md:flex ${compact ? 'min-h-[18px]' : 'min-h-[22px]'}`}>
                {hints.map((hint) => (
                  <li
                    key={hint}
                    className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-data-[hovered=true]:opacity-100"
                  >
                    {hint}
                  </li>
                ))}
              </ul>
            )}
            <span className="text-xs font-semibold text-brand-600 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-data-[hovered=true]:opacity-100">
              {item.hoverActionLabel ?? 'Detayları Gör →'}
            </span>
          </div>
        </div>
      )}
    </button>
  );
}
