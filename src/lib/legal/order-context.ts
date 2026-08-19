import { findCatalogItem, quoteProduct, type PaymentPeriod, type ProductQuote } from '@/lib/commerce';
import { vatRateLabel } from '@/config/vat';
import { formatMinor } from '@/lib/money';
import { getOrderById } from '@/lib/payments/orders';
import type { OrderRecord, PaymentCustomer, PaymentProviderId } from '@/lib/payments/types';

export type LegalBuyer = {
  name: string;
  email: string;
  phone: string;
  address: string;
  billingType: string;
  company?: string;
};

export type LegalOrderView = {
  orderNumber: string | null;
  createdAt: string | null;
  productId: string;
  productName: string;
  description: string;
  packageLabel: string;
  quantity: number;
  unitPriceLabel: string;
  subtotalLabel: string;
  vatLabel: string;
  vatRateLabel: string;
  extrasLabel: string;
  totalLabel: string;
  currency: string;
  paymentMethod: string;
  fulfillment: string;
  fulfillmentTime: string;
  buyer: LegalBuyer | null;
};

const PERIOD_LABEL: Record<PaymentPeriod, string> = {
  monthly: 'Aylık dönem',
  annual: 'Yıllık peşin',
  once: 'Tek seferlik',
};

const PROVIDER_LABEL: Record<PaymentProviderId, string> = {
  qnbpay: 'QNBpay',
  iyzico: 'QNBpay',
};

export function fulfillmentFor(productId: string): { method: string; time: string } {
  if (productId.startsWith('ticketgo-') || productId.startsWith('ai-')) {
    return {
      method:
        'Dijital erişim, kullanıcı hesabı ve lisans/abonelik aktivasyonu. Fiziksel kargo yapılmaz.',
      time:
        'Ödemenin onaylanmasından sonra erişim ve kurulum takvimi, satın alınan paketin teslim açıklamasına ve karşılıklı planlamaya göre yürütülür. Anında indirme taahhüdü yoktur.',
    };
  }
  if (productId.startsWith('support-')) {
    return {
      method: 'Hizmetin başlatılması ve dijital destek kanalı üzerinden ifa.',
      time: 'Ödeme onayından sonra ilgili destek döneminin başlangıcı sipariş teyidinde bildirilir.',
    };
  }
  if (productId === 'discovery') {
    return {
      method: 'Hizmetin başlatılması ve keşif çıktısının elektronik teslimi.',
      time: 'Keşif çalışması, pakette belirtilen süre aralığında (kural olarak 2–3 hafta) planlanır.',
    };
  }
  return {
    method: 'Hesap üzerinde tanımlama ve/veya dijital erişim. Fiziksel teslimat yoktur.',
    time: 'Ödeme onayından sonra makul süre içinde tanımlama yapılır.',
  };
}

function fromQuote(quote: ProductQuote, extras?: { order?: OrderRecord; provider?: PaymentProviderId | null }): LegalOrderView {
  const primary = quote.lines[0];
  const unitMinor = primary ? Math.round(primary.amountMinor / Math.max(1, quote.quantity)) : 0;
  const extraLines = quote.lines.slice(1);
  const fulfill = fulfillmentFor(quote.productId);
  const item = findCatalogItem(quote.productId);
  const buyer = extras?.order?.customer ? buyerFromCustomer(extras.order.customer) : null;
  return {
    orderNumber: extras?.order?.orderNumber ?? null,
    createdAt: extras?.order?.createdAt ?? null,
    productId: quote.productId,
    productName: quote.productName,
    description: quote.description,
    packageLabel: item && 'name' in item ? `${item.name} · ${PERIOD_LABEL[quote.period]}` : PERIOD_LABEL[quote.period],
    quantity: quote.quantity,
    unitPriceLabel: formatMinor(unitMinor, quote.currency),
    subtotalLabel: formatMinor(quote.subtotalMinor, quote.currency),
    vatLabel: formatMinor(quote.vatMinor, quote.currency),
    vatRateLabel: quote.vatRatePercent > 0 ? `%${quote.vatRatePercent}` : vatRateLabel(),
    extrasLabel: extraLines.length
      ? extraLines.map((line) => `${line.label}: ${formatMinor(line.amountMinor, quote.currency)}`).join('; ')
      : 'Belirtilmediği sürece kargo, montaj veya kapıda ödeme masrafı yoktur.',
    totalLabel: formatMinor(quote.totalMinor, quote.currency),
    currency: quote.currency,
    paymentMethod: extras?.provider ? PROVIDER_LABEL[extras.provider] : extras?.order?.paymentProvider
      ? PROVIDER_LABEL[extras.order.paymentProvider]
      : 'QNBpay / QNB Sanal POS',
    fulfillment: fulfill.method,
    fulfillmentTime: fulfill.time,
    buyer,
  };
}

function buyerFromCustomer(customer: PaymentCustomer): LegalBuyer {
  return {
    name: `${customer.firstName} ${customer.lastName}`.trim(),
    email: customer.email,
    phone: customer.phone,
    address: [customer.address, customer.city, customer.zipCode].filter(Boolean).join(', '),
    billingType: customer.billingType === 'company' ? 'Kurumsal' : 'Bireysel',
    company: customer.company,
  };
}

export async function resolveLegalOrder(input: {
  product?: string;
  productId?: string;
  period?: string;
  qty?: string;
  order?: string;
}): Promise<LegalOrderView | null> {
  if (input.order) {
    const record = await getOrderById(input.order);
    if (record) {
      const quote = quoteProduct({
        productId: record.productId,
        period: record.period,
        quantity: record.quantity,
      });
      if ('error' in quote) {
        const fulfill = fulfillmentFor(record.productId);
        return {
          orderNumber: record.orderNumber,
          createdAt: record.createdAt,
          productId: record.productId,
          productName: record.productName,
          description: record.description,
          packageLabel: PERIOD_LABEL[record.period],
          quantity: record.quantity,
          unitPriceLabel: formatMinor(Math.round(record.subtotalMinor / Math.max(1, record.quantity)), record.currency),
          subtotalLabel: formatMinor(record.subtotalMinor, record.currency),
          vatLabel: formatMinor(record.vatMinor, record.currency),
          vatRateLabel: record.vatRatePercent ? `%${record.vatRatePercent}` : vatRateLabel(),
          extrasLabel: 'Sipariş kaydındaki tutar esas alınır.',
          totalLabel: formatMinor(record.amountMinor, record.currency),
          currency: record.currency,
          paymentMethod: record.paymentProvider ? PROVIDER_LABEL[record.paymentProvider] : 'Belirtilmedi',
          fulfillment: fulfill.method,
          fulfillmentTime: fulfill.time,
          buyer: buyerFromCustomer(record.customer),
        };
      }
      return fromQuote(quote, { order: record, provider: record.paymentProvider });
    }
  }

  const productId = input.productId?.trim() || input.product?.trim();
  if (!productId) return null;
  const period = (input.period === 'monthly' || input.period === 'annual' || input.period === 'once' ? input.period : 'annual') as PaymentPeriod;
  const quote = quoteProduct({
    productId,
    period,
    quantity: Number(input.qty ?? '1'),
  });
  if ('error' in quote) return null;
  return fromQuote(quote);
}
