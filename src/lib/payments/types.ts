export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'payment_started';

export type PaymentProviderId = 'tami' | 'qnbpay' | 'iyzico'; // qnbpay/iyzico: legacy stored orders only

export type PaymentCard = {
  holderName: string;
  number: string;
  expireMonth: string;
  expireYear: string;
  cvv: string;
};

export type PaymentCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  identityNumber: string;
  company?: string;
  taxOffice?: string;
  address: string;
  city: string;
  country: string;
  zipCode?: string;
  billingType: 'individual' | 'company';
};

export type PaymentAttemptStatus = 'created' | 'redirected' | 'verified' | 'failed' | 'cancelled' | 'paid';

export type PaymentAttempt = {
  id: string;
  orderId: string;
  provider: PaymentProviderId;
  status: PaymentAttemptStatus;
  amountMinor: number;
  currency: string;
  installment: number;
  cardProgram: string | null;
  providerReference: string | null;
  providerTransactionId: string | null;
  responseCode: string | null;
  mdStatus: string | null;
  bankReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentAuditEntry = {
  id: string;
  orderId: string;
  attemptId?: string;
  provider?: PaymentProviderId;
  event: string;
  status?: string;
  providerReference?: string;
  responseCode?: string;
  createdAt: string;
};

export type OrderRecord = {
  id: string;
  orderNumber: string;
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  period: 'monthly' | 'annual' | 'once';
  currency: string;
  unitAmountMinor: number;
  subtotalMinor: number;
  vatMinor: number;
  vatRatePercent: number;
  amountMinor: number;
  status: OrderStatus;
  paymentProvider: PaymentProviderId | null;
  providerPaymentId: string | null;
  providerConversationId: string | null;
  providerToken: string | null;
  paymentTransactionId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customer: PaymentCustomer;
  idempotencyKey: string;
  statusToken: string;
  paidAt: string | null;
  distanceSalesVersion: string;
  preInformationVersion: string;
  legalAcceptedAt: string;
  processedTransactionIds?: string[];
  billingAddress?: string;
  originalAmountMinor?: number;
  originalCurrency?: string;
  exchangeRate?: number | null;
  exchangeRateSource?: string | null;
  exchangeRateDate?: string | null;
  chargedAmountMinor?: number | null;
  chargedCurrency?: string | null;
  legalAcceptance?: {
    distanceSalesVersion: string;
    preInformationVersion: string;
    acceptedAt: string;
    marketingOptIn: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePaymentInput = {
  order: OrderRecord;
  callbackUrl: string;
  cancelUrl: string;
  ip: string;
  installment?: number;
  cardProgram?: string;
  card?: PaymentCard;
};

export type CreatePaymentResult =
  | { ok: true; redirectUrl: string; providerReference: string; threeDsHtml?: string }
  | { ok: false; code: 'not_configured' | 'provider_error'; message: string };

export type VerifyPaymentInput = {
  order: OrderRecord;
  payload: Record<string, string>;
};

export type VerifyPaymentResult =
  | {
      ok: true;
      status: 'paid' | 'failed' | 'cancelled' | 'processing';
      providerPaymentId?: string;
      paymentTransactionId?: string;
      conversationId?: string;
    }
  | { ok: false; message: string };

export interface PaymentProvider {
  id: PaymentProviderId;
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  getPaymentStatus(order: OrderRecord): Promise<VerifyPaymentResult>;
  refundPayment(order: OrderRecord): Promise<{ ok: boolean; message: string }>;
  voidPayment?(order: OrderRecord): Promise<{ ok: boolean; message: string }>;
}

export type PublicOrderView = {
  orderNumber: string;
  productName: string;
  status: OrderStatus;
  paymentProvider: PaymentProviderId | null;
  amountLabel: string;
  currency: string;
};
