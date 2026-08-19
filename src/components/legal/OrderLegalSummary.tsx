import type { LegalOrderView } from '@/lib/legal/order-context';



export function OrderLegalSummary({ order }: { order: LegalOrderView }) {

  return (

    <div className="legal-summary border border-line bg-canvas px-4 py-4 text-sm leading-7">

      <h3 className="font-semibold text-ink">Sipariş özeti</h3>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">

        <div>

          <dt className="text-muted">Sipariş no</dt>

          <dd>{order.orderNumber ?? 'Ödeme başlatıldığında oluşur'}</dd>

        </div>

        <div>

          <dt className="text-muted">Tarih</dt>

          <dd>

            {order.createdAt

              ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(

                  new Date(order.createdAt)

                )

              : 'Sipariş anında kaydedilir'}

          </dd>

        </div>

        <div>

          <dt className="text-muted">Ürün / hizmet</dt>

          <dd>{order.productName}</dd>

        </div>

        <div>

          <dt className="text-muted">Paket</dt>

          <dd>{order.packageLabel}</dd>

        </div>

        <div>

          <dt className="text-muted">Adet</dt>

          <dd>{order.quantity}</dd>

        </div>

        <div>

          <dt className="text-muted">KDV Hariç Bedel</dt>

          <dd>{order.subtotalLabel}</dd>

        </div>

        <div>

          <dt className="text-muted">KDV ({order.vatRateLabel})</dt>

          <dd>{order.vatLabel}</dd>

        </div>

        <div className="sm:col-span-2">

          <dt className="text-muted">Toplam Satış Bedeli (KDV Dahil)</dt>

          <dd className="font-semibold text-ink">

            {order.totalLabel} ({order.currency})

          </dd>

        </div>

        <div className="sm:col-span-2">

          <dt className="text-muted">Ödeme yöntemi</dt>

          <dd>{order.paymentMethod}</dd>

        </div>

        <div className="sm:col-span-2">

          <dt className="text-muted">İfa / teslim</dt>

          <dd>{order.fulfillment}</dd>

        </div>

      </dl>

      {order.buyer ? (

        <p className="mt-3">

          Alıcı: {order.buyer.name}

          {order.buyer.company ? ` (${order.buyer.company})` : ''} · {order.buyer.email} · {order.buyer.phone}

        </p>

      ) : (

        <p className="mt-3 text-muted">

          Alıcı bilgileri, ödeme sayfasında beyan ettiğiniz ad, soyad, adres, telefon, e-posta ve fatura bilgileridir.

        </p>

      )}

    </div>

  );

}

