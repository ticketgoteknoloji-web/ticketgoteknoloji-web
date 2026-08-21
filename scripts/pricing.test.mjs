import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

function roundUsd(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function recurringPrice(monthlyPrice, period, discount) {
  if (period === 'monthly') return roundUsd(monthlyPrice);
  return roundUsd(monthlyPrice * (1 - discount));
}

function billedAnnualTotal(monthlyPrice, discount) {
  return roundUsd(recurringPrice(monthlyPrice, 'annual', discount) * 12);
}

function annualSavingsAmount(monthlyPrice, discount) {
  return roundUsd(monthlyPrice * 12 - billedAnnualTotal(monthlyPrice, discount));
}

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), '../docs/pricing-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

test('catalog uses USD and VAT notice', () => {
  assert.equal(catalog.currency, 'USD');
  assert.equal(catalog.taxNotice, 'Prices exclude VAT. 20% VAT is added at checkout.');
  assert.ok(catalog.taxNoticeTr.includes('KDV hariç'));
  assert.ok(catalog.taxNoticeTr.includes('%20'));
  assert.equal(catalog.lastReviewedAt, '2026-08-18');
});

test('annual discount stays in the 15–20% band', () => {
  assert.equal(catalog.annualDiscount, 0.2);
  for (const value of Object.values(catalog.annualDiscountByCategory)) {
    assert.ok(value >= 0.15 && value <= 0.2);
  }
});

test('monthly to annual conversion uses the configured discount', () => {
  assert.equal(recurringPrice(249, 'monthly', 0.2), 249);
  assert.equal(recurringPrice(249, 'annual', 0.2), 199.2);
  assert.equal(billedAnnualTotal(249, 0.2), 2390.4);
  assert.equal(annualSavingsAmount(249, 0.2), 597.6);
  assert.equal(recurringPrice(790, 'annual', 0.2), 632);
  assert.equal(recurringPrice(590, 'annual', 0.15), 501.5);
});

test('annual total is always lower than 12 monthly payments', () => {
  const items = [...catalog.plans, ...catalog.aiPlans, ...catalog.supportPlans, ...catalog.services].filter(
    (item) => typeof item.monthlyPrice === 'number'
  );
  for (const item of items) {
    const discount = catalog.annualDiscountByCategory[item.category] ?? catalog.annualDiscount;
    const yearly = billedAnnualTotal(item.monthlyPrice, discount);
    assert.ok(yearly < item.monthlyPrice * 12, item.id);
  }
});

test('Growth is the most popular Ticket-Go and AI plan', () => {
  const ticketPopular = catalog.plans.filter((item) => item.popular).map((item) => item.id);
  const aiPopular = catalog.aiPlans.filter((item) => item.popular).map((item) => item.id);
  const servicePopular = catalog.services.filter((item) => item.popular).map((item) => item.id);
  const supportPopular = catalog.supportPlans.filter((item) => item.popular).map((item) => item.id);
  assert.deepEqual(ticketPopular, ['ticketgo-growth']);
  assert.deepEqual(aiPopular, ['ai-growth']);
  assert.deepEqual(servicePopular, ['growth-product']);
  assert.deepEqual(supportPopular, ['support-professional']);
});

test('value ladders increase with package depth', () => {
  const ticketPrices = catalog.plans.filter((item) => item.monthlyPrice).map((item) => item.monthlyPrice);
  assert.deepEqual(ticketPrices, [249, 790, 1690]);
  const supportPrices = catalog.supportPlans.map((item) => item.monthlyPrice);
  assert.deepEqual(supportPrices, [890, 1790, 3900]);
});

test('docs catalog matches src catalog', () => {
  const srcPath = join(dirname(fileURLToPath(import.meta.url)), '../src/data/pricing-catalog.json');
  const srcCatalog = JSON.parse(readFileSync(srcPath, 'utf8'));
  assert.deepEqual(srcCatalog, catalog);
});

test('required catalog collections exist', () => {
  assert.ok(catalog.plans.length >= 4);
  assert.ok(catalog.services.length >= 4);
  assert.ok(catalog.addOns.length >= 4);
  assert.ok(catalog.usageLimits.length >= 1);
  assert.ok(catalog.overageRates.length >= 1);
  assert.ok(catalog.setupFees.length >= 1);
  assert.ok(catalog.assumptions.length >= 1);
});
