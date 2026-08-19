import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { paymentUrl } from '@/lib/commerce';
import { cancelUnpaidOrder } from '@/lib/payments/service';
import { BRAND_SUPPORT_EMAIL } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Ödeme İptal Edildi',
  robots: { index: false, follow: false },
};

type Search = { order?: string };

export default async function PaymentCancelledPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const order = params.order ? await cancelUnpaidOrder(params.order) : null;

  const retryHref = order ? paymentUrl(order.productId, order.period, order.quantity) : '/pricing';

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <BrandLogo variant="header" />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink">Ödeme İşlemi İptal Edildi</h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        {order?.status === 'paid'
          ? 'Bu sipariş daha önce ödenmiş görünüyor. Destek için sipariş numaranızla yazın.'
          : 'Ödeme alınmadı. İsterseniz işlemi yeniden başlatabilirsiniz.'}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={retryHref} className="btn btn-primary rounded-full px-6 py-3">
          Ödemeye Geri Dön
        </Link>
        <Link href="/" className="btn btn-secondary rounded-full px-6 py-3">
          Ana Sayfaya Dön
        </Link>
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="btn btn-secondary rounded-full px-6 py-3">
          Destek
        </a>
      </div>
    </main>
  );
}
