'use client';

import { Check, Mail, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SolutionDetail } from '@/data/solutions';
import { createMailto, infoRequestBody } from '@/lib/mailto';
import { quoteUrl } from '@/lib/pricing';
import { BRAND_INFO_EMAIL, BRAND_SUPPORT_EMAIL } from '@/lib/site';
import { acquireScrollLock } from '@/lib/scroll-lock';
import { WhatsAppButton } from '@/components/WhatsAppButton';

type SolutionDetailModalProps = {
  solution: SolutionDetail | null;
  open: boolean;
  onClose: () => void;
};

export function SolutionDetailModal({ solution, open, onClose }: SolutionDetailModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !solution) return;
    openerRef.current = document.activeElement as HTMLElement;
    const release = acquireScrollLock();
    const panel = panelRef.current;
    const getFocusables = () =>
      panel?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );

    window.setTimeout(() => getFocusables()?.[0]?.focus(), 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusables();
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      release();
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
    };
  }, [open, solution, onClose]);

  if (!mounted || !open || !solution) return null;

  const Icon = solution.Icon;
  const problemsTitle = solution.problemsLabel ?? 'Hangi İhtiyaçları Çözer?';
  const processTitle = solution.processLabel ?? 'Teknik Yaklaşım';
  const hasTechnical =
    Boolean(solution.technicalApproach) ||
    Boolean(solution.process?.length) ||
    solution.visual === 'architecture' ||
    Boolean(solution.tags?.length);

  return createPortal(
    <div
      className="site-modal-overlay architecture-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="site-modal-panel architecture-modal-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-7">
          <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600">
            <Icon size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              {solution.category ?? 'Çözüm'}
            </p>
            <h3 id={titleId} className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              {solution.modalTitle ?? solution.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">{solution.subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Pencereyi kapat"
            onClick={onClose}
            className="btn btn-ghost min-h-11 min-w-11 rounded-full p-2"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden px-5 py-5 sm:px-7 sm:py-6">
          {solution.introLabel === '' ? null : (
            <h4 className="text-sm font-semibold text-ink">{solution.introLabel ?? 'Çözüm nedir?'}</h4>
          )}
          <p id={descriptionId} className={`${solution.introLabel === '' ? '' : 'mt-2'} max-w-3xl text-sm leading-7 text-muted`}>
            {solution.description}
          </p>

          <div className="mt-6 space-y-4">
            {solution.features.length ? (
              <InfoPanel title={solution.featuresLabel ?? 'Neler Sunuyor?'}>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {solution.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink">
                      <Check size={14} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </InfoPanel>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {solution.problems.length ? (
                <InfoPanel title={problemsTitle}>
                  <ul className="space-y-2">
                    {solution.problems.map((problem) => (
                      <li key={problem} className="rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink">
                        {problem}
                      </li>
                    ))}
                  </ul>
                </InfoPanel>
              ) : null}

              {solution.useCases.length ? (
                <InfoPanel title={solution.useCasesLabel ?? 'Kullanım Alanları'}>
                  <div className="flex flex-wrap gap-2">
                    {solution.useCases.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </InfoPanel>
              ) : null}

              {hasTechnical ? (
                <InfoPanel title={solution.visual === 'architecture' && !solution.technicalApproach ? 'Mimari' : processTitle}>
                  {solution.tags?.length ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {solution.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {solution.technicalApproach ? (
                    <p className="text-sm leading-6 text-muted">{solution.technicalApproach}</p>
                  ) : null}
                  {solution.visual === 'architecture' ? (
                    <div className={solution.technicalApproach ? 'mt-3' : undefined}>
                      <ArchitectureVisual nodes={solution.architecture ?? []} />
                    </div>
                  ) : solution.process?.length ? (
                    <div className={solution.technicalApproach ? 'mt-3' : undefined}>
                      <ProcessVisual steps={solution.process} />
                    </div>
                  ) : null}
                </InfoPanel>
              ) : null}
            </div>
          </div>

          {solution.visual === 'dashboard' ? <DashboardVisual /> : null}
          {solution.visual === 'architecture' && solution.process ? (
            <div className="mt-4">
              <ProcessVisual steps={solution.process} />
            </div>
          ) : null}

          {solution.integrations?.length ? (
            <div className="mt-4">
              <InfoPanel title={solution.integrationsLabel ?? 'Entegrasyonlar'}>
                <div className="flex flex-wrap gap-2">
                  {solution.integrations.map((item) => (
                    <span key={item} className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-ink">
                      {item}
                    </span>
                  ))}
                </div>
              </InfoPanel>
            </div>
          ) : null}

          {solution.benefits?.length ? (
            <div className="mt-4">
              <InfoPanel title={solution.benefitsLabel ?? 'İşletmeye Katkısı'}>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {solution.benefits.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink">
                      <Check size={14} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </InfoPanel>
            </div>
          ) : null}

          {solution.analytics?.length ? (
            <div className="mt-4">
              <InfoPanel title={solution.analyticsLabel ?? 'Veri & Analitik'}>
                <ChipList items={solution.analytics} />
              </InfoPanel>
            </div>
          ) : null}

          {solution.automation?.length ? (
            <div className="mt-4">
              <InfoPanel title="Otomasyon">
                <ChipList items={solution.automation} />
              </InfoPanel>
            </div>
          ) : null}

          {solution.aiExtensions?.length ? (
            <div className="mt-4">
              <InfoPanel title="AI ile genişletilebilir alanlar">
                <p className="mb-3 text-sm leading-6 text-muted">
                  Aşağıdakiler aktif ürün vaadi değil; bu sektöre uyarlanabilecek entegrasyon senaryolarıdır.
                </p>
                <ul className="space-y-2">
                  {solution.aiExtensions.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink">
                      <Check size={14} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </InfoPanel>
            </div>
          ) : null}

          {solution.securityNotes?.length ? (
            <div className="mt-4">
              <InfoPanel title="Güvenlik yaklaşımı">
                <ul className="space-y-2">
                  {solution.securityNotes.map((item) => (
                    <li key={item} className="text-sm leading-6 text-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </InfoPanel>
            </div>
          ) : null}

          {solution.productExample ? (
            <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Ürün örneği</p>
              <p className="mt-2 text-sm font-semibold text-ink">{solution.productExample.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{solution.productExample.text}</p>
              {solution.productExample.href ? (
                <a
                  href={solution.productExample.href}
                  className="mt-3 inline-flex text-sm font-semibold text-brand-700 underline"
                >
                  Detayları incele
                </a>
              ) : null}
            </div>
          ) : null}

          {solution.exampleFlow?.length ? (
            <div className="mt-4">
              <InfoPanel title={solution.exampleFlowLabel ?? 'Örnek akış'}>
                <ProcessVisual steps={solution.exampleFlow} />
              </InfoPanel>
            </div>
          ) : null}

          {solution.footerNote ? (
            <p className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm leading-6 text-ink">
              {solution.footerNote}
            </p>
          ) : null}

          {/* ── Action bar ── */}
          <div className="mt-8 border-t border-line pt-5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Secondary contact actions */}
              <a
                href={createMailto({
                  to: solution.category === 'Destek' ? BRAND_SUPPORT_EMAIL : BRAND_INFO_EMAIL,
                  subject: `TicketGo Teknoloji | ${solution.modalTitle ?? solution.title} Hakkında Bilgi Talebi`,
                  body: infoRequestBody(
                    solution.modalTitle ?? solution.title,
                    `İlgilendiğim çözüm: ${solution.modalTitle ?? solution.title}`
                  ),
                })}
                className="btn btn-secondary gap-2"
              >
                <Mail size={14} aria-hidden="true" />
                E-posta ile Bilgi Al
              </a>
              <WhatsAppButton
                message={`Merhaba TicketGo Teknoloji, ${solution.modalTitle ?? solution.title} hakkında bilgi almak istiyorum.`}
                label="WhatsApp ile Görüş"
              />
              {/* Primary CTA — rightmost / highest weight */}
              <Link
                href={solution.ctaHref ?? quoteUrl(solution.contactType, solution.ctaMessage)}
                onClick={onClose}
                className="btn btn-primary sm:ml-auto"
              >
                {solution.ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-ink">
          {item}
        </span>
      ))}
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ProcessVisual({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-ink">
            {step}
          </span>
          {index < steps.length - 1 ? (
            <span className="text-brand-500" aria-hidden>
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ArchitectureVisual({ nodes }: { nodes: string[] }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink">
        Web / Mobil / CRM
      </span>
      <span className="text-brand-500" aria-hidden>
        ↓
      </span>
      <span className="w-full rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
        API & Integration Layer
      </span>
      <span className="text-brand-500" aria-hidden>
        ↓
      </span>
      <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {nodes.map((item) => (
          <span key={item} className="rounded-xl border border-line bg-canvas px-2 py-2 text-xs font-medium text-ink">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function DashboardVisual() {
  const activities = [
    { item: 'Satış özeti', status: 'Hazır' },
    { item: 'Operasyon görünümü', status: 'Güncel' },
    { item: 'Müşteri özeti', status: 'Filtrelendi' },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-line bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Platform Özeti</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Aktif süreç', value: '128' },
          { label: 'Açık görev', value: '36' },
          { label: 'Tamamlanan', value: '84' },
          { label: 'Bekleyen onay', value: '8' },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-surface p-3">
            <p className="text-xs font-medium text-muted">{card.label}</p>
            <p className="mt-1 text-lg font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-xs font-medium text-muted">Trend (çizgi grafik)</p>
          <svg viewBox="0 0 100 36" className="mt-3 h-16 w-full text-brand-500" aria-hidden>
            <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,28 18,22 36,24 54,12 72,16 100,8" />
          </svg>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-xs font-medium text-muted">Dağılım (sütun grafik)</p>
          <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden>
            {[40, 62, 48, 78, 55, 70, 44].map((h, i) => (
              <span key={i} className="w-full rounded-sm bg-brand-400/80" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Demo aktivite tablosu</caption>
          <thead className="bg-canvas text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Aktivite</th>
              <th className="px-3 py-2 font-medium">Durum</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((row) => (
              <tr key={row.item} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{row.item}</td>
                <td className="px-3 py-2 text-brand-700">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
