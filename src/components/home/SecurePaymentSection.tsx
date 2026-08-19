'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, CheckCircle2, CreditCard, Landmark, ShieldCheck, ShoppingBag } from 'lucide-react';
import { FeatureCardGrid } from '@/components/FeatureCardGrid';
import { paymentHighlights } from '@/data/paymentHighlights';

type SecurePaymentSectionProps = {
  providerReady: boolean;
};

const flow = [
  { title: 'Sipariş', text: 'Ürün ve tutar sistem kaynağından doğrulanır.', Icon: ShoppingBag, img: '/images/payment/payment-order.webp' },
  { title: 'Güvenli Ödeme', text: 'Kart oturumu ödeme sağlayıcısına yönlendirilir.', Icon: CreditCard, img: '/images/payment/payment-secure.webp' },
  { title: '3D Secure', text: 'Kart sahibinin banka doğrulaması kullanılabilir.', Icon: ShieldCheck, img: '/images/payment/payment-3ds.webp' },
  { title: 'Banka / QNBpay', text: 'İşlem sağlayıcı altyapısında yürütülür.', Icon: Landmark, img: '/images/payment/payment-bank.webp' },
  { title: 'Doğrulama', text: 'Sonuç sunucu tarafında kontrol edilir.', Icon: BadgeCheck, img: '/images/payment/payment-verification.webp' },
  { title: 'Ödeme Sonucu', text: 'Sipariş durumu kayıtla güncellenir.', Icon: CheckCircle2, img: '/images/payment/payment-result.webp', status: 'Doğrulandı' },
] as const;

export function SecurePaymentSection({ providerReady }: SecurePaymentSectionProps) {
  const providerLabel = providerReady ? 'QNBpay Sanal POS' : 'QNBpay / QNB Sanal POS entegrasyonuna hazır';

  return (
    <section id="guvenli-odeme" className="section-accent relative scroll-section overflow-hidden">
      <div className="section-wrap section-y relative">
        <div className="grid min-w-0 items-start gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <p className="eyebrow mb-3">Güvenli Ödeme</p>
            <h2 className="section-title">Güvenli ve Entegre Ödeme Altyapısı</h2>
            <p className="section-subtitle">
              Dijital ürün ve hizmet ödemelerinizi güvenli, izlenebilir ve kullanıcı dostu bir ödeme deneyimiyle tamamlayın.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
              TicketGo Teknoloji ödeme akışları; sipariş doğrulama, güvenli ödeme yönlendirmesi, 3D Secure ve işlem sonucu
              doğrulaması gibi temel süreçleri tek bir yapı altında yönetmeye hazırdır.
            </p>

            <div className="mt-6 max-w-md rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="eyebrow">Ödeme Sağlayıcısı</p>
              <p className="mt-1 text-sm font-medium text-ink">{providerLabel}</p>
            </div>

            <FeatureCardGrid
              items={paymentHighlights}
              compact
              className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              renderPreview={(item) => (
                <p className="mt-2 flex-1 text-sm leading-6 text-muted">{item.subtitle}</p>
              )}
            />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/payment"
                className="btn btn-primary group w-full gap-2 shadow-soft sm:w-auto"
              >
                Güvenli Ödemeye Geç
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <a href="#odeme-akisi" className="btn btn-secondary w-full sm:w-auto">
                Ödeme Sürecini İncele
              </a>
            </div>

            <p className="mt-6 max-w-xl text-xs leading-6 text-muted">
              Kart bilgilerinin güvenli biçimde işlenmesi, ödeme sağlayıcısının resmi entegrasyon modeli üzerinden
              yürütülmelidir. Hassas kart verileri kalıcı olarak saklanmaz.
            </p>
          </div>

          <aside id="odeme-akisi" className="min-w-0 scroll-section">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
              <p className="eyebrow">Ödeme akışı</p>
              <p className="mt-2 text-lg font-semibold text-ink">Güvenli tahsilat konsepti</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Kart bilgisi bu sayfada istenmez. Gerçek ödeme formu yalnızca güvenli ödeme sayfasında açılır.
              </p>
              <ol className="mt-6 space-y-3">
                {flow.map((step, index) => (
                  <li key={step.title}>
                    <div className="overflow-hidden rounded-xl border border-line">
                      {/* Görsel thumbnail */}
                      <div className="relative h-[88px] w-full overflow-hidden">
                        <Image
                          src={step.img}
                          alt=""
                          fill
                          sizes="(max-width:1024px) 100vw, 480px"
                          className="object-cover object-center transition-transform duration-300 hover:scale-105"
                          loading="lazy"
                          aria-hidden="true"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>
                      {/* Kart içeriği */}
                      <div className="flex items-start gap-3 px-3 py-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600">
                          <step.Icon size={18} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink">{step.title}</p>
                            {'status' in step && step.status ? (
                              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                                {step.status}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted">{step.text}</p>
                        </div>
                      </div>
                    </div>
                    {index < flow.length - 1 ? (
                      <p className="py-1 text-center text-brand-500" aria-hidden>
                        ↓
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
