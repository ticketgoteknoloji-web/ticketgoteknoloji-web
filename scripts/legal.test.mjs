import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distance = readFileSync(join(root, 'src/app/legal/distance-sales/page.tsx'), 'utf8');
const pre = readFileSync(join(root, 'src/app/legal/pre-information/page.tsx'), 'utf8');
const refund = readFileSync(join(root, 'src/app/legal/refund/page.tsx'), 'utf8');
const kvkk = readFileSync(join(root, 'src/app/kvkk/page.tsx'), 'utf8');
const privacy = readFileSync(join(root, 'src/app/privacy/page.tsx'), 'utf8');
const checkout = readFileSync(join(root, 'src/components/payment/PaymentCheckout.tsx'), 'utf8');
const company = readFileSync(join(root, 'src/config/company.ts'), 'utf8');
const versions = readFileSync(join(root, 'src/lib/legal/versions.ts'), 'utf8');
const globals = readFileSync(join(root, 'src/app/globals.css'), 'utf8');

test('distance sales contract has required sections', () => {
  for (const heading of [
    '1. Taraflar',
    '2. Sözleşmenin konusu',
    '5. Ödeme',
    '7. Cayma hakkı',
    '10. Cayma hakkının istisnaları',
    '14. Uyuşmazlıklar',
    'QNBpay',
  ]) {
    assert.match(distance, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(distance, /on dört gün|14 gün/);
  assert.doesNotMatch(distance, /Dijital ürünlerde kesinlikle iade yoktur/);
});

test('pre-information form is distinct and complete', () => {
  assert.match(pre, /SATICI \/ HİZMET SAĞLAYICI/);
  assert.match(pre, /Toplam fiyat/);
  assert.match(pre, /Cayma bildiriminin yapılacağı iletişim kanalı/);
  assert.doesNotMatch(pre, /LegalPlaceholder/);
});

test('refund policy avoids blanket digital no-refund', () => {
  assert.match(refund, /Hatalı \/ mükerrer ödeme/);
  assert.match(refund, /COMPANY\.emails\.support/);
  assert.match(refund, /şeklinde genel bir kural uygulanmaz/);
});

test('KVKK and privacy are separate documents', () => {
  assert.match(kvkk, /Veri sorumlusu/);
  assert.match(kvkk, /Hukuki sebepler/);
  assert.match(kvkk, /COMPANY\.emails\.kvkk/);
  assert.match(privacy, /Politikanın kapsamı/);
  assert.match(privacy, /kendi sistemlerinde saklamaz/);
  assert.doesNotMatch(privacy, /title="Hukuki sebepler"/);
});

test('checkout splits contract consent from KVKK notice', () => {
  assert.match(checkout, /siparişe ve ödeme yükümlülüğüne ilişkin koşulları kabul ediyorum/);
  assert.match(checkout, /Kişisel verilerinizin işlenmesine ilişkin detayları/);
  assert.match(checkout, /Kampanya ve duyurular hakkında elektronik ileti/);
  assert.match(checkout, /Güvenli Ödeme Yap/);
  assert.match(checkout, /disabled=\{!canPay\}/);
  assert.doesNotMatch(
    checkout,
    /Mesafeli Satış Sözleşmesi, Ön Bilgilendirme Formu, Gizlilik Politikası, KVKK Aydınlatma Metni ve İptal/
  );
});

test('company registry placeholders are centralized', () => {
  const site = readFileSync(join(root, 'src/lib/site.ts'), 'utf8');
  assert.match(company, /\[ŞİRKET MERKEZ ADRESİ EKLENECEK\]/);
  assert.match(company, /\[MERSİS NO EKLENECEK\]/);
  assert.match(company, /\[VERGİ DAİRESİ EKLENECEK\]/);
  assert.match(company, /\[VERGİ DAİRESİ \/ VERGİ NO EKLENECEK\]/);
  assert.match(company, /\[KEP ADRESİ EKLENECEK\]/);
  assert.match(company, /status === 'confirmed'/);
  assert.match(company, /field\('confirmed', BRAND_TAX_OFFICE/);
  assert.match(company, /field\('confirmed', BRAND_TAX_NUMBER/);
  assert.match(company, /field\('confirmed', BRAND_ADDRESS/);
  assert.match(company, /field\('confirmed', BRAND_MERSIS/);
  assert.match(site, /Bodrum Vergi Dairesi/);
  assert.match(site, /8430931108/);
  assert.match(site, /0843093110800001/);
  assert.match(site, /Gümbet Mah\. Mister Hadi Sok\. No:2-A1 Bodrum\/MUĞLA/);
  assert.match(distance, /SATICI BİLGİLERİ/);
  assert.match(kvkk, /CompanyInfoPanel/);
  assert.match(versions, /2026\.08-v1/);
});

test('print stylesheet exists', () => {
  assert.match(globals, /@media print/);
});
