#!/usr/bin/env bash
# ticketgoteknoloji.com — Node production (API routes for iyzico / QNBpay)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> ticketgoteknoloji.com build"
npm ci
npm run build

echo ""
echo "==> Static export kapatıldı. Ödeme API route'ları Node süreci gerektirir."
echo "    Başlatma: npm run start"
echo "    Gerekli env: .env.example (IYZICO_*, QNBPAY_*, PAYMENT_*)"
echo "    Site: https://www.ticketgoteknoloji.com"
