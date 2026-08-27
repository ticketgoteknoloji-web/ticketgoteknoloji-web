import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { DownloadAccessActivator } from '@/components/download/DownloadAccessActivator';
import { getStoredPackageByProductId } from '@/lib/downloads/store';
import { getOrderById } from '@/lib/payments/orders';
import { toPublicOrder } from '@/lib/payments/service';
import { formatTryRate } from '@/lib/fx/format';
import { formatMinor } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Ödeme Başarılı',
  robots: { index: false, follow: false },
};

type Search = { order?: string };

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const order = params.order ? await getOrderById(params.order) : null;
  if (!order || order.status !== 'paid') {
    redirect(order ? `/payment/failure?order=${encodeURIComponent(order.id)}` : '/payment/failure');
  }

  const downloadPkg = await getStoredPackageByProductId(order.productId);
  const paid = toPublicOrder(order);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <BrandLogo variant="header" />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink">Ödeme Başarıyla Tamamlandı</h1>
      <dl className="mt-8 space-y-3 rounded-2xl border border-line bg-surface p-6 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Sipariş numarası</dt>
          <dd className="font-semibold text-ink">{paid.orderNumber}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Ürün</dt>
          <dd className="text-ink">{paid.productName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Ödeme yöntemi</dt>
          <dd className="text-ink">Tami / Garanti BBVA Sanal POS</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">İşlem durumu</dt>
          <dd className="font-semibold text-ink">Ödendi</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Tutar</dt>
          <dd className="text-ink">{paid.amountLabel}</dd>
        </div>
        {order.originalAmountMinor != null && order.chargedAmountMinor != null ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Katalog fiyatı</dt>
            <dd className="text-ink">{formatMinor(order.originalAmountMinor, order.originalCurrency || 'USD')}</dd>
          </div>
        ) : null}
        {order.exchangeRate ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Uygulanan TCMB kuru</dt>
            <dd className="text-ink">1 USD = {formatTryRate(order.exchangeRate)}</dd>
          </div>
        ) : null}
      </dl>

      {downloadPkg ? <DownloadAccessActivator orderId={order.id} token={order.statusToken} /> : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {!downloadPkg ? (
          <Link href="/" className="btn btn-primary rounded-full px-6 py-3">
            Ana Sayfaya Dön
          </Link>
        ) : null}
        <Link href="/contact?need=Sipariş%20Detayı" className="btn btn-secondary rounded-full px-6 py-3">
          Sipariş Detayları
        </Link>
      </div>
    </main>
  );
}
