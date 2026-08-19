'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import {
  MonitorSmartphone,
  Layers,
  Workflow,
  GitBranch,
  Database,
  BrainCircuit,
  Plug,
} from 'lucide-react';
import { SolutionDetailModal } from '@/components/SolutionDetailModal';
import { getFeature } from '@/data/featureCatalog';
import { useSelectableCards } from '@/hooks/useSelectableCards';
import type { SolutionDetail } from '@/data/solutions';
import type { LucideIcon } from 'lucide-react';

type ArchLayer = {
  id: string;
  label: string;
  category: string;
  description: string;
  Icon: LucideIcon;
  wide?: boolean;
  cardImage?: string;
};

const archLayers: ArchLayer[] = [
  {
    id: 'arch-web',
    label: 'Web / Mobile',
    category: 'Kullanıcı Kanalı',
    description: 'Kullanıcıların sisteme eriştiği web ve mobil deneyim katmanı.',
    Icon: MonitorSmartphone,
    cardImage: '/images/arch/arch-web-mobile.webp',
  },
  {
    id: 'arch-application',
    label: 'Application Layer',
    category: 'Uygulama',
    description: 'İş kurallarının ve ürün fonksiyonlarının çalıştığı uygulama katmanı.',
    Icon: Layers,
    cardImage: '/images/arch/arch-application.webp',
  },
  {
    id: 'crm',
    label: 'CRM · Operations · SaaS',
    category: 'İş Modülleri',
    description: 'Müşteri, operasyon ve SaaS süreçlerini yöneten iş modülleri.',
    Icon: Workflow,
    wide: true,
    cardImage: '/images/arch/arch-crm-modules.webp',
  },
  {
    id: 'api',
    label: 'API Gateway',
    category: 'Entegrasyon',
    description: 'Sistemler ve servisler arasındaki veri iletişimini yöneten entegrasyon katmanı.',
    Icon: GitBranch,
    cardImage: '/images/arch/arch-api-gateway.webp',
  },
  {
    id: 'analytics',
    label: 'Data & Analytics',
    category: 'Veri',
    description: 'Veri toplama, raporlama ve analitik işlemlerini yöneten veri katmanı.',
    Icon: Database,
    cardImage: '/images/arch/arch-data-analytics.webp',
  },
  {
    id: 'ai',
    label: 'AI Services',
    category: 'Akıllı Servisler',
    description: 'Yapay zekâ servisleri ve akıllı otomasyonların entegre edilebildiği servis katmanı.',
    Icon: BrainCircuit,
    cardImage: '/images/arch/arch-ai-services.webp',
  },
  {
    id: 'arch-integrations',
    label: 'External Integrations',
    category: 'Dış Sistemler',
    description: 'Ödeme, ERP, CRM, SMS, e-posta ve üçüncü taraf servis bağlantıları.',
    Icon: Plug,
    cardImage: '/images/arch/arch-external-integrations.webp',
  },
];

export function ArchitectureMap() {
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);
  const cardSelection = useSelectableCards();

  const layerItems = archLayers
    .map((layer) => {
      const feature = getFeature(layer.id);
      return feature ?? null;
    })
    .filter((item): item is SolutionDetail => Boolean(item));

  const selected = layerItems.find((item) => item.id === cardSelection.selectedId) ?? null;

  return (
    <section className="section-muted">
      <div className="section-wrap section-y">
        <h2 className="section-title">Modern Dijital Ürün Mimarisi</h2>
        <p className="section-subtitle">
          Farklı iş süreçlerini tek ekosistemde buluşturabilecek modüler sistemler tasarlıyoruz. Bu görsel teknik bir
          dokümantasyon değil; ürün katmanlarının konsept temsilidir.
        </p>

        {/* Horizontal architecture flow */}
        <div className="arch-flow mt-10">
          {archLayers.map((layer, index) => {
            const feature = getFeature(layer.id);
            const isActive = cardSelection.isActive(layer.id);
            const isHovered = cardSelection.isHovered(layer.id);

            return (
              <div key={layer.id} className="arch-flow-item">
                {/* Architecture card */}
                <button
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`${layer.label} — Detayları gör`}
                  disabled={!feature}
                  onMouseEnter={() => feature && cardSelection.onMouseEnter(layer.id)}
                  onMouseLeave={() => feature && cardSelection.onMouseLeave(layer.id)}
                  onClick={() => {
                    if (!feature) return;
                    cardSelection.onSelect(layer.id);
                    setOpen(true);
                  }}
                  data-active={isActive}
                  data-hovered={isHovered}
                  className={`arch-card group ${layer.wide ? 'arch-card-wide' : ''} ${!feature ? 'cursor-default' : ''}`}
                >
                  {/* Card image */}
                  {layer.cardImage && (
                    <span className="arch-card-img-wrap">
                      <Image
                        src={layer.cardImage}
                        alt=""
                        fill
                        sizes="(max-width:768px) 50vw, 200px"
                        className="arch-card-img"
                        aria-hidden="true"
                        loading="lazy"
                      />
                    </span>
                  )}

                  {/* Category label */}
                  <span className="arch-card-category">{layer.category}</span>

                  {/* Icon */}
                  <span className="arch-card-icon-wrap">
                    <layer.Icon
                      size={20}
                      className="arch-card-icon"
                      aria-hidden="true"
                    />
                  </span>

                  {/* Title */}
                  <span className="arch-card-title">{layer.label}</span>

                  {/* Description */}
                  <span className="arch-card-desc">{layer.description}</span>
                </button>

                {/* Arrow connector — not after last item */}
                {index < archLayers.length - 1 ? (
                  <span className="arch-arrow" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <p className="mt-8 text-center text-xs leading-5 text-muted">
          Katmanlar, ihtiyaçlara göre bağımsız veya birlikte ölçeklenebilecek modüler ürün yapısını temsil eder.
        </p>

        <SolutionDetailModal open={open} solution={selected} onClose={closeModal} />
      </div>
    </section>
  );
}
