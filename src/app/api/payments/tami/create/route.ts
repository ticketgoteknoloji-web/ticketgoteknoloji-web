import { handleCreatePayment } from '@/lib/payments/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleCreatePayment(request, 'tami');
}
