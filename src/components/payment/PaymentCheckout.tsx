'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BrandLogo } from '@/components/BrandLogo';
import { getProductImage } from '@/lib/payments/product-images';
import { LegalTrigger } from '@/components/legal/LegalTrigger';
import { useUsdTryQuote } from '@/components/price/FxProvider';
import type { QnbCardProgram } from '@/config/qnbpay-card-programs';
import type { ProductQuote } from '@/lib/commerce';
import { convertUsdToTry } from '@/lib/fx/convert';
import { formatTcmbDate, formatTryAmount, formatTryRate, formatUsdAmount } from '@/lib/fx/format';
import { LEGAL_VERSIONS } from '@/lib/legal/versions';
import { formatMinor, fromMinorUnits } from '@/lib/money';
import {
  cardNumberValid,
  cvvValid,
  detectCardNetwork,
  digitsOnly,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  maskCardNumber,
  networkLabel,
  shouldAdvanceCardField,
  UI_CARD_NUMBER_DIGITS,
  UI_CARD_NUMBER_INPUT_MAX,
} from '@/lib/payments/card-ui';
import { createMailto, createWhatsAppLink } from '@/lib/mailto';
import { BRAND_SUPPORT_EMAIL, BRAND_WHATSAPP_NUMBER } from '@/lib/site';

type PaymentCheckoutProps = {
  quote: ProductQuote;
  configured: boolean;
  testMode: boolean;
  providerStatus?: string;
  cardPrograms: QnbCardProgram[];
  installments: number[];
};

export function PaymentCheckout({ quote, configured, testMode, providerStatus, cardPrograms }: PaymentCheckoutProps) {
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  );
  const [billingType, setBillingType] = useState<'individual' | 'company'>('individual');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'error' | 'info'>('info');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [company, setCompany] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [installment, setInstallment] = useState(1);
  const [tamiInstallments, setTamiInstallments] = useState<Array<{ count: number; enabled: boolean }>>([
    { count: 1, enabled: true },
  ]);
  const [installmentFallback, setInstallmentFallback] = useState(false);
  const [installmentNotice, setInstallmentNotice] = useState<string | null>(null);
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [debugPayment, setDebugPayment] = useState(false);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);

  function focusNextCardField(target: HTMLInputElement | null) {
    queueMicrotask(() => target?.focus());
  }

  const totalLabel = formatMinor(quote.totalMinor, quote.currency);
  const subtotalLabel = formatMinor(quote.subtotalMinor, quote.currency);
  const vatLabel = formatMinor(quote.vatMinor, quote.currency);
  const { quote: fx, loading: fxLoading } = useUsdTryQuote();
  const usdTotal = fromMinorUnits(quote.totalMinor);
  const tryTotal = fx.rate != null ? convertUsdToTry(usdTotal, fx.rate) : null;
  const tryTotalLabel = tryTotal != null ? formatTryAmount(tryTotal) : null;
  const enabledPrograms = cardPrograms.filter((item) => item.enabled);
  const network = detectCardNetwork(cardNumber);
  const customerValid =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    email.includes('@') &&
    Boolean(phone.trim()) &&
    Boolean(address.trim()) &&
    Boolean(city.trim()) &&
    (billingType === 'company'
      ? /^\d{10}$/.test(digitsOnly(identityNumber))
      : /^\d{11}$/.test(digitsOnly(identityNumber))) &&
    (billingType === 'individual' || (Boolean(company.trim()) && Boolean(taxOffice.trim())));
  const holderOk = Boolean(cardHolder.trim());
  const panOk = cardNumberValid(cardNumber);
  const expiryOk = expiryValid(expiry);
  const cvvOk = cvvValid(cvv, network);
  const cardOk = holderOk && panOk && expiryOk && cvvOk;
  const orderOk = Boolean(quote.productId) && quote.totalMinor > 0;
  const canPay = Boolean(
    configured && customerValid && cardOk && legalAccepted && orderOk && !submitting && tryTotal != null
  );
  const fxRateAvailable = fx.rate != null;
  const tryTotalAvailable = tryTotal != null;
  const blockedBy = [
    !customerValid ? 'customerValid' : null,
    !holderOk ? 'holderOk' : null,
    !panOk ? 'panOk' : null,
    !expiryOk ? 'expiryOk' : null,
    !cvvOk ? 'cvvOk' : null,
    !cardOk ? 'cardOk' : null,
    !legalAccepted ? 'legalAccepted' : null,
    !orderOk ? 'orderOk' : null,
    !configured ? 'configured' : null,
    submitting ? 'submitting' : null,
    configured && !tryTotalAvailable ? 'tryTotal' : null,
    configured && !fxRateAvailable ? 'fx.rate' : null,
  ].filter((item): item is string => Boolean(item));
  const offeredInstallments = tamiInstallments.filter((item) => item.enabled && item.count >= 1);
  const installmentChoices = offeredInstallments.length ? offeredInstallments : [{ count: 1, enabled: true }];
  const tamiPointPanel = {
    available: false,
    amountLabel: null as string | null,
    redeemable: false,
  };

  useEffect(() => {
    const bin = digitsOnly(cardNumber).slice(0, 6);
    if (bin.length < 6) {
      setTamiInstallments([{ count: 1, enabled: true }]);
      setInstallment(1);
      setInstallmentFallback(false);
      setInstallmentNotice(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/payments/tami/installments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ bin }),
        });
        const data = (await response.json()) as {
          success?: boolean;
          installments?: Array<{ count: number; enabled: boolean }>;
          fallback?: boolean;
          message?: string | null;
        };
        if (cancelled) return;
        const next = (data.installments ?? [])
          .filter((item) => item && item.enabled !== false && Number(item.count) >= 1)
          .map((item) => ({ count: Number(item.count), enabled: true }));
        const unique = Array.from(new Map(next.map((item) => [item.count, item])).values()).sort(
          (a, b) => a.count - b.count
        );
        const options = unique.length ? unique : [{ count: 1, enabled: true }];
        setTamiInstallments(options);
        setInstallmentFallback(data.fallback === true || data.success === false);
        setInstallmentNotice(data.fallback || data.success === false ? data.message || 'Taksit seçenekleri şu anda alınamadı. Ödeme tek çekim olarak devam eder.' : null);
        setInstallment((current) => (options.some((item) => item.count === current) ? current : 1));
      } catch {
        if (cancelled) return;
        setTamiInstallments([{ count: 1, enabled: true }]);
        setInstallment(1);
        setInstallmentFallback(true);
        setInstallmentNotice('Taksit seçenekleri şu anda alınamadı. Ödeme tek çekim olarak devam eder.');
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cardNumber]);

  useEffect(() => {
    try {
      setDebugPayment(new URLSearchParams(window.location.search).get('debugPayment') === '1');
    } catch {
      setDebugPayment(false);
    }
  }, []);

  useEffect(() => {
    if (!debugPayment) return;
    console.debug('[Payment Debug]', {
      customerValid,
      holderOk,
      panOk,
      expiryOk,
      cvvOk,
      cardOk,
      legalAccepted,
      orderOk,
      configured,
      fxRateAvailable,
      tryTotalAvailable,
      submitting,
      canPay,
    });
  }, [
    debugPayment,
    customerValid,
    holderOk,
    panOk,
    expiryOk,
    cvvOk,
    cardOk,
    legalAccepted,
    orderOk,
    configured,
    fxRateAvailable,
    tryTotalAvailable,
    submitting,
    canPay,
  ]);

  const errors = {
    holder: !holderOk ? 'Kart üzerindeki ad soyad alanını doldurun.' : null,
    pan: !panOk ? 'Kart numarasını kontrol edin.' : null,
    expiry: !expiryOk ? 'Son kullanma tarihi geçersiz.' : null,
    cvv: !cvvOk ? 'Güvenlik kodunu kontrol edin.' : null,
  };

  function clearSensitiveCard() {
    setCvv('');
    setCardNumber('');
    setExpiry('');
  }

  async function startTamiPayment(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (submitting) return;
    if (!configured) {
      setMessageTone('info');
      setMessage('Tami / Garanti BBVA ödeme altyapısı henüz tamamlanmadı. POS/Terminal aktivasyonu bekleniyor.');
      return;
    }
    setAttempted(true);
    if (!customerValid || !cardOk || !legalAccepted || !orderOk) {
      setMessageTone('error');
      setMessage('Kart bilgilerini, fatura bilgilerini ve sözleşmeyi kontrol edin.');
      return;
    }
    setMessage(null);
    setSubmitting(true);
    try {
      const expiryDigits = digitsOnly(expiry);
      const response = await fetch('/api/payments/tami/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          productId: quote.productId,
          period: quote.period,
          quantity: quote.quantity,
          installment,
          idempotencyKey: idempotencyKey.current,
          legalAccepted,
          marketingOptIn,
          distanceSalesVersion: LEGAL_VERSIONS.distanceSales.version,
          preInformationVersion: LEGAL_VERSIONS.preInformation.version,
          customer: {
            firstName,
            lastName,
            email,
            phone,
            identityNumber,
            company,
            taxOffice,
            address,
            city,
            country: 'Turkey',
            billingType,
          },
          card: {
            holderName: cardHolder.trim(),
            number: digitsOnly(cardNumber),
            expireMonth: expiryDigits.slice(0, 2),
            expireYear: expiryDigits.slice(2, 4),
            cvv: digitsOnly(cvv),
          },
        }),
      });
      const data = (await response.json()) as {
        redirectUrl?: string;
        message?: string;
        error?: string;
        configured?: boolean;
        missingEnv?: string[];
        callbackLocal?: boolean;
      };
      if (data.configured === false) {
        if (data.missingEnv?.length) {
          console.info(`[TicketGo payment] Tami credentials missing. Set: ${data.missingEnv.join(', ')}`);
        } else {
          console.info('[TicketGo payment] Tami credentials missing. Check server-side environment variables.');
        }
      }
      if (data.callbackLocal) {
        console.info(
          '[TicketGo payment] Callback URL is localhost. Remote Tami 3D Secure tests require PAYMENT_PUBLIC_BASE_URL or TAMI_CALLBACK_URL on a public HTTPS origin.'
        );
      }
      if (data.redirectUrl) {
        clearSensitiveCard();
        window.location.assign(data.redirectUrl);
        return;
      }
      setMessageTone(data.configured === false ? 'info' : 'error');
      setMessage(
        data.configured === false
          ? 'Tami / Garanti BBVA ödeme altyapısı henüz tamamlanmadı. POS/Terminal aktivasyonu bekleniyor.'
          : data.message || data.error || 'Tami ile ödeme başlatılamadı.'
      );
      setSubmitting(false);
    } catch {
      setMessageTone('error');
      setMessage('Bir hata oluştu. Lütfen tekrar deneyin.');
      setSubmitting(false);
    }
  }

  return (
    <div className="section-wrap min-w-0 overflow-x-hidden py-8 sm:py-10">
      <div className="mb-6">
        <BrandLogo variant="header" />
      </div>

      <div className="max-w-3xl">
        <h1 className="font-sans text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">Güvenli Ödeme</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Siparişinizi tamamlamak için kart ve fatura bilgilerinizi girin. Ödeme Tami / Garanti BBVA Sanal POS güvenli altyapısı üzerinden
          yürütülür.
        </p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
          Ana sayfaya dön
        </Link>
      </div>

      <form
        onSubmit={startTamiPayment}
        className="mt-8 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]"
        autoComplete="on"
        noValidate
      >
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <section className="site-card min-w-0 overflow-hidden">
            {/* Ürün görseli */}
            {(() => {
              const img = getProductImage(quote.productId);
              return (
                <div className="relative h-[170px] w-full overflow-hidden">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(max-width:1024px) 100vw, 24rem"
                    className="object-cover object-center"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
              );
            })()}
            <div className="p-5 sm:p-6">
            <p className="eyebrow">Sipariş özeti</p>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-ink">{quote.productName}</h2>
            <p className="mt-1 text-sm text-muted">{quote.description}</p>
            <p className="mt-3 inline-flex rounded-full border border-line bg-canvas px-2.5 py-0.5 text-[11px] font-medium text-muted">
              {quote.periodLabel} · {quote.quantity} adet · KDV hariç fiyat
            </p>

            <dl className="payment-summary mt-5">
              {quote.lines.length > 1
                ? quote.lines.map((line) => (
                    <div key={line.label} className="payment-summary-row">
                      <dt>{line.label}</dt>
                      <dd>{formatMinor(line.amountMinor, quote.currency)}</dd>
                    </div>
                  ))
                : null}
              <hr className="payment-summary-divider" />
              <div className="payment-summary-row">
                <dt>KDV Hariç</dt>
                <dd>{subtotalLabel}</dd>
              </div>
              <div className="payment-summary-row">
                <dt>KDV (%{quote.vatRatePercent})</dt>
                <dd>{vatLabel}</dd>
              </div>
              <div className="payment-summary-row payment-summary-total">
                <dt>KDV Dahil Toplam</dt>
                <dd>{totalLabel}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-xl border border-line bg-canvas px-3 py-3 text-xs leading-5 text-muted">
              <p className="flex justify-between gap-3">
                <span>Ürün fiyatı (KDV dahil)</span>
                <span className="font-medium text-ink">{formatUsdAmount(usdTotal)}</span>
              </p>
              <p className="mt-2 flex justify-between gap-3">
                <span>TCMB USD satış kuru</span>
                <span className="font-medium text-ink">
                  {fx.rate != null ? `1 USD = ${formatTryRate(fx.rate)}` : fxLoading ? 'Yükleniyor' : 'Alınamadı'}
                </span>
              </p>
              <p className="mt-2 flex justify-between gap-3">
                <span>Kur tarihi</span>
                <span className="font-medium text-ink">{formatTcmbDate(fx.date) || '—'}</span>
              </p>
              <p className="mt-2 flex justify-between gap-3 text-sm">
                <span className="font-medium text-ink">Kartınızdan çekilecek tutar</span>
                <span className="font-semibold text-ink">
                  {tryTotalLabel ?? (fxLoading ? 'Hesaplanıyor...' : 'TL karşılığı şu anda hesaplanamıyor')}
                </span>
              </p>
              <p className="mt-2 text-[11px] leading-5">
                Kur kaynağı: Türkiye Cumhuriyet Merkez Bankası. USD olarak belirlenen ürün fiyatının TL karşılığı, ödeme işlemi başlatıldığı anda geçerli TCMB USD satış kuru kullanılarak hesaplanır.
              </p>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">
              Tahsil edilecek tutar KDV dahil toplam bedelin TCMB kuru ile TL karşılığıdır. Fiyatlar katalogdan sunucu tarafında hesaplanır.
            </p>
            </div>
          </section>
        </aside>

        <div className="grid min-w-0 gap-6">
          <section className="site-card min-w-0 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Kart bilgileri</h2>
            <p className="mt-1 text-sm text-muted">3D Secure ile güvenli ödeme. Kart verileri saklanmaz.</p>

            <div className="mt-5 max-w-sm">
              <div className="pay-card-face">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">TicketGo Teknoloji</p>
                  <p className="text-[11px] font-medium text-white/80">{networkLabel(network) ?? 'Kart'}</p>
                </div>
                <p className="mt-6 font-mono text-sm tracking-[0.1em] sm:text-base">{maskCardNumber(cardNumber)}</p>
                <div className="mt-5 flex items-end justify-between gap-3 text-xs">
                  <span className="max-w-[65%] truncate uppercase tracking-wide text-white/85">
                    {cardHolder.trim() || 'Kart Sahibi'}
                  </span>
                  <span className="text-white/75">{digitsOnly(expiry).length === 4 ? expiry : 'AA / YY'}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="font-medium text-ink">Kart Üzerindeki Ad Soyad</span>
              <input
                id="card-holder"
                autoComplete="cc-name"
                spellCheck={false}
                value={cardHolder}
                onChange={(event) => setCardHolder(event.target.value)}
                aria-invalid={attempted && !holderOk}
                aria-describedby={attempted && !holderOk ? 'card-holder-error' : undefined}
                className="field-input mt-1"
              />
              {attempted && errors.holder ? (
                <span id="card-holder-error" role="alert" className="mt-1 block text-xs text-danger">
                  {errors.holder}
                </span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="font-medium text-ink">Kart Numarası</span>
              <span className="relative mt-1 block">
                <input
                  id="card-number"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={UI_CARD_NUMBER_INPUT_MAX}
                  enterKeyHint="next"
                  value={cardNumber}
                  onChange={(event) => {
                    const next = formatCardNumber(event.target.value);
                    setCardNumber(next);
                    if (shouldAdvanceCardField(cardNumber, next, UI_CARD_NUMBER_DIGITS)) {
                      focusNextCardField(expiryRef.current);
                    }
                  }}
                  onPaste={(event) => {
                    event.preventDefault();
                    const next = formatCardNumber(event.clipboardData.getData('text'));
                    setCardNumber(next);
                    if (shouldAdvanceCardField(cardNumber, next, UI_CARD_NUMBER_DIGITS)) {
                      focusNextCardField(expiryRef.current);
                    }
                  }}
                  aria-invalid={attempted && !panOk}
                  aria-describedby={attempted && !panOk ? 'card-number-error' : 'card-network'}
                  className="field-input pr-28 font-mono tracking-wide"
                  placeholder="xxxx xxxx xxxx xxxx"
                />
                <span id="card-network" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-muted">
                  {networkLabel(network) ?? 'Visa / MC / TROY'}
                </span>
              </span>
              {attempted && errors.pan ? (
                <span id="card-number-error" role="alert" className="mt-1 block text-xs text-danger">
                  {errors.pan}
                </span>
              ) : null}
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-ink">Son Kullanma Tarihi</span>
                <input
                  id="card-expiry"
                  ref={expiryRef}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  spellCheck={false}
                  maxLength={7}
                  enterKeyHint="next"
                  value={expiry}
                  onChange={(event) => {
                    const next = formatExpiry(event.target.value);
                    setExpiry(next);
                    if (shouldAdvanceCardField(expiry, next, 4)) {
                      focusNextCardField(cvvRef.current);
                    }
                  }}
                  onPaste={(event) => {
                    event.preventDefault();
                    const next = formatExpiry(event.clipboardData.getData('text'));
                    setExpiry(next);
                    if (shouldAdvanceCardField(expiry, next, 4)) {
                      focusNextCardField(cvvRef.current);
                    }
                  }}
                  aria-invalid={attempted && !expiryOk}
                  aria-describedby={attempted && !expiryOk ? 'card-expiry-error' : undefined}
                  className="field-input mt-1 font-mono"
                  placeholder="AA / YY"
                />
                {attempted && errors.expiry ? (
                  <span id="card-expiry-error" role="alert" className="mt-1 block text-xs text-danger">
                    {errors.expiry}
                  </span>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="font-medium text-ink">Güvenlik Kodu</span>
                <input
                  id="card-cvv"
                  ref={cvvRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={3}
                  value={cvv}
                  onChange={(event) => setCvv(digitsOnly(event.target.value).slice(0, 3))}
                  aria-invalid={attempted && !cvvOk}
                  aria-describedby={attempted && !cvvOk ? 'card-cvv-help card-cvv-error' : 'card-cvv-help'}
                  className="field-input mt-1 tracking-[0.35em]"
                />
                <span id="card-cvv-help" className="mt-1 block text-xs leading-5 text-muted">
                  Kartınızın arka yüzündeki 3 haneli güvenlik kodu.
                </span>
                {attempted && errors.cvv ? (
                  <span id="card-cvv-error" role="alert" className="mt-1 block text-xs text-danger">
                    {errors.cvv}
                  </span>
                ) : null}
              </label>
            </div>
          </div>

          <h3 className="mt-7 text-base font-semibold text-ink">Fatura Bilgileri</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-ink">Ad</span>
              <input required name="firstName" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field-input mt-1" />
            </label>
            <label className="text-sm">
              <span className="font-medium text-ink">Soyad</span>
              <input required name="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="field-input mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-ink">E-posta</span>
              <input required type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-input mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-ink">Telefon</span>
              <input required name="phone" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="field-input mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-ink">Fatura tipi</span>
              <select
                className="field-input mt-1"
                value={billingType}
                onChange={(event) => {
                  setBillingType(event.target.value as 'individual' | 'company');
                  setIdentityNumber('');
                }}
              >
                <option value="individual">Bireysel</option>
                <option value="company">Kurumsal</option>
              </select>
            </label>
            {billingType === 'company' ? (
              <>
                <label className="text-sm sm:col-span-2">
                  <span className="font-medium text-ink">Firma Ünvanı</span>
                  <input name="company" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className="field-input mt-1" />
                </label>
                <label className="text-sm">
                  <span className="font-medium text-ink">Vergi dairesi</span>
                  <input name="taxOffice" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} className="field-input mt-1" />
                </label>
                <label className="text-sm">
                  <span className="font-medium text-ink">Vergi numarası</span>
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    pattern="\d{10}"
                    value={identityNumber}
                    onChange={(event) => setIdentityNumber(digitsOnly(event.target.value).slice(0, 10))}
                    className="field-input mt-1 font-mono"
                    placeholder="10 haneli vergi no"
                  />
                </label>
              </>
            ) : (
              <label className="text-sm sm:col-span-2">
                <span className="font-medium text-ink">T.C. kimlik numarası</span>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={11}
                  pattern="\d{11}"
                  value={identityNumber}
                  onChange={(event) => setIdentityNumber(digitsOnly(event.target.value).slice(0, 11))}
                  className="field-input mt-1 font-mono"
                  placeholder="11 haneli T.C. kimlik no"
                />
              </label>
            )}
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-ink">Fatura adresi</span>
              <input required name="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} className="field-input mt-1" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="font-medium text-ink">Şehir</span>
              <input required name="city" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} className="field-input mt-1" />
            </label>
          </div>

          {installmentChoices.length > 1 ? (
            <label className="mt-4 block text-sm">
              <span className="font-medium text-ink">Taksit seçenekleri</span>
              <select className="field-input mt-1" value={installment} onChange={(event) => setInstallment(Number(event.target.value))}>
                {installmentChoices.map((item) => (
                  <option key={item.count} value={item.count}>
                    {item.count <= 1 ? 'Tek çekim' : `${item.count} Taksit`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mt-4 text-sm text-muted">Tek çekim</p>
          )}
          {installmentFallback && installmentNotice ? (
            <p className="mt-2 text-xs leading-5 text-muted">{installmentNotice}</p>
          ) : null}

          {tamiPointPanel.available && tamiPointPanel.amountLabel ? (
            <div className="mt-4 rounded-xl border border-line bg-canvas px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Kullanılabilir Puan</p>
              <p className="mt-1 text-sm font-semibold text-ink">{tamiPointPanel.amountLabel}</p>
              {tamiPointPanel.redeemable ? (
                <button type="button" className="btn btn-secondary mt-3 w-full">
                  Puan Kullan
                </button>
              ) : null}
            </div>
          ) : null}

          {enabledPrograms.length ? (
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {enabledPrograms.map((program) => (
                <li key={program.id} className="rounded-lg border border-line px-2.5 py-2 text-[11px] font-medium text-ink">
                  {program.displayName}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 space-y-3 border-t border-line pt-5 text-xs leading-5 text-muted">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} required />
              <span>
                <LegalTrigger doc="distance-sales" className="font-semibold text-brand-600 hover:underline">
                  Mesafeli Satış Sözleşmesi
                </LegalTrigger>
                &apos;ni ve{' '}
                <LegalTrigger doc="pre-information" className="font-semibold text-brand-600 hover:underline">
                  Ön Bilgilendirme Formu
                </LegalTrigger>
                &apos;nu okudum; siparişe ve ödeme yükümlülüklerine ilişkin koşulları kabul ediyorum.
              </span>
            </label>
            <p>
              <LegalTrigger doc="kvkk" className="font-semibold text-brand-600 hover:underline">
                KVKK Aydınlatma Metni
              </LegalTrigger>
              {' · '}
              <LegalTrigger doc="privacy" className="font-semibold text-brand-600 hover:underline">
                Gizlilik Politikası
              </LegalTrigger>
              {' · '}
              <LegalTrigger doc="refund" className="font-semibold text-brand-600 hover:underline">
                İptal / İade Koşulları
              </LegalTrigger>
            </p>
            <p>Kişisel verilerinizin işlenmesine ilişkin detayları KVKK Aydınlatma Metni&apos;nde okuyabilirsiniz.</p>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} />
              <span>Kampanya ve duyurular hakkında elektronik ileti almak istiyorum. (İsteğe bağlı.)</span>
            </label>
          </div>

          {message ? <p className={`mt-4 text-sm ${messageTone === 'error' ? 'text-danger' : 'text-brand-700'}`}>{message}</p> : null}

          <div className="payment-pay-bar mt-6">
            <span className="text-sm font-medium text-ink">Karttan çekilecek (KDV Dahil)</span>
            <strong>{tryTotalLabel ?? totalLabel}</strong>
          </div>
          {!configured ? (
            <p className="mt-2 text-xs text-warning">
              Tami / Garanti BBVA ödeme altyapısı henüz tamamlanmadı. POS/Terminal aktivasyonu bekleniyor.
            </p>
          ) : tryTotal == null && !fxLoading ? (
            <p className="mt-2 text-xs text-warning">TCMB kuru alınamadı. TL tahsilatı şu anda başlatılamaz.</p>
          ) : null}
          {debugPayment ? (
            <div className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[11px] leading-5 text-muted">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-wide text-ink">Payment debug</p>
              <ul className="mt-1 space-y-0.5">
                <li>customerValid: {customerValid ? 'TRUE' : 'FALSE'}</li>
                <li>holderOk: {holderOk ? 'TRUE' : 'FALSE'}</li>
                <li>panOk: {panOk ? 'TRUE' : 'FALSE'}</li>
                <li>expiryOk: {expiryOk ? 'TRUE' : 'FALSE'}</li>
                <li>cvvOk: {cvvOk ? 'TRUE' : 'FALSE'}</li>
                <li>cardOk: {cardOk ? 'TRUE' : 'FALSE'}</li>
                <li>legalAccepted: {legalAccepted ? 'TRUE' : 'FALSE'}</li>
                <li>orderOk: {orderOk ? 'TRUE' : 'FALSE'}</li>
                <li>configured: {configured ? 'TRUE' : 'FALSE'}</li>
                <li>fxLoading: {fxLoading ? 'TRUE' : 'FALSE'}</li>
                <li>fx.rate: {fxRateAvailable ? 'TRUE' : 'FALSE'}</li>
                <li>tryTotal: {tryTotalAvailable ? 'TRUE' : 'FALSE'}</li>
                <li>submitting: {submitting ? 'TRUE' : 'FALSE'}</li>
                <li>canPay: {canPay ? 'TRUE' : 'FALSE'}</li>
                <li>quote.productId: {quote.productId || '—'}</li>
                <li>quote.period: {quote.period}</li>
                <li>quote.totalMinor &gt; 0: {quote.totalMinor > 0 ? 'TRUE' : 'FALSE'}</li>
                <li>providerStatus: {providerStatus || '—'}</li>
                <li>testMode: {testMode ? 'TRUE' : 'FALSE'}</li>
              </ul>
              {!canPay ? (
                <div className="mt-2 font-sans text-[11px] text-ink">
                  <p>BLOCKED BY:</p>
                  <ul className="mt-0.5">
                    {(blockedBy.length ? blockedBy : ['(unknown)']).map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <button type="submit" disabled={!canPay} aria-disabled={!canPay} className="btn btn-primary mt-4 w-full">
            {submitting ? 'Ödeme işlemi başlatılıyor...' : 'Güvenli Ödeme Yap'}
          </button>
          <p className="mt-2 text-center text-xs text-muted">Tami / Garanti BBVA · 3D Secure</p>
          <p className="mt-3 text-xs leading-5 text-muted">
            Ödeme konusunda destek alın:{' '}
            <a
              className="email-link font-semibold text-brand-600"
              href={createMailto({
                to: BRAND_SUPPORT_EMAIL,
                subject: 'TicketGo Teknoloji | Ödeme Desteği',
                body: 'Merhaba TicketGo Teknoloji Ekibi,\n\nÖdeme konusunda yardım almak istiyorum.\n\nTalebim:\n',
              })}
            >
              {BRAND_SUPPORT_EMAIL}
            </a>
            {(() => {
              const waHref = createWhatsAppLink({
                phone: BRAND_WHATSAPP_NUMBER,
                message: 'Merhaba TicketGo Teknoloji, ödeme işlemi konusunda destek almak istiyorum.',
              });
              return waHref ? (
                <>
                  {' · '}
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-600"
                  >
                    WhatsApp Destek
                  </a>
                </>
              ) : null;
            })()}
          </p>
        </section>
        </div>
      </form>
    </div>
  );
}
