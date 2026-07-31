/**
 * Bonus Scraper Pro — 3 Tiers, Multi-Period Pricing
 *
 * Starter:    $6/wk  $20/mo  $50/qtr  $180/yr  — Monday, Standard Data
 * Pro:        $12/wk $35/mo  $90/qtr  $300/yr  — Mon+Thu+Sat, Advanced Data
 * Elite:      $24/wk $70/mo  $180/qtr $600/yr  — Daily, Expert Data
 *
 * Trial: free first month on Starter monthly only.
 */

const TIERS = {
  trial: {
    id: 'trial',
    name: 'Free Trial',
    price: 0,
    priceLabel: 'Free',
    periodLabel: 'first month',
    scrapeDays: ['Monday'],
    dataLevel: 'basic',
    dataLabel: 'Standard Data',
    scheduleLabel: 'Monday',
    stripePriceId: '',
    trialEnabled: false,
    features: {
      csvExport: true, jsonExport: false, valueScoring: false,
      filteredExport: false, fullTextSearch: false,
      rawDataAccess: false, customFields: false, prioritySupport: false,
      autoRegistration: false,
    },
  },
  tier1: {
    id: 'tier1',
    name: 'Starter',
    prices: {
      weekly: { amount: 600, label: '$6/wk', period: 'week', stripePriceId: process.env.STRIPE_PRICE_STARTER_WEEKLY || '' },
      monthly: { amount: 2000, label: '$20/mo', period: 'month', stripePriceId: process.env.STRIPE_PRICE_STARTER || '' },
      quarterly: { amount: 5000, label: '$50/qtr', period: 'quarter', stripePriceId: process.env.STRIPE_PRICE_STARTER_QUARTERLY || '' },
      annual: { amount: 18000, label: '$180/yr', period: 'year', stripePriceId: process.env.STRIPE_PRICE_STARTER_ANNUAL || '' },
    },
    scrapeDays: ['Monday'],
    dataLevel: 'basic',
    dataLabel: 'Standard Data',
    scheduleLabel: 'Monday',
    trialEnabled: true,
    features: {
      csvExport: true, jsonExport: false, valueScoring: false,
      filteredExport: false, fullTextSearch: false,
      rawDataAccess: false, customFields: false, prioritySupport: false,
      autoRegistration: false,
    },
  },
  tier2: {
    id: 'tier2',
    name: 'Pro',
    prices: {
      weekly: { amount: 1200, label: '$12/wk', period: 'week', stripePriceId: process.env.STRIPE_PRICE_PRO_WEEKLY || '' },
      monthly: { amount: 3500, label: '$35/mo', period: 'month', stripePriceId: process.env.STRIPE_PRICE_PRO || '' },
      quarterly: { amount: 9000, label: '$90/qtr', period: 'quarter', stripePriceId: process.env.STRIPE_PRICE_PRO_QUARTERLY || '' },
      annual: { amount: 30000, label: '$300/yr', period: 'year', stripePriceId: process.env.STRIPE_PRICE_PRO_ANNUAL || '' },
    },
    scrapeDays: ['Monday', 'Thursday', 'Saturday'],
    dataLevel: 'advanced',
    dataLabel: 'Advanced Data',
    scheduleLabel: 'Mon + Thu + Sat',
    trialEnabled: false,
    features: {
      csvExport: true, jsonExport: true, valueScoring: true,
      filteredExport: true, fullTextSearch: false,
      rawDataAccess: false, customFields: false, prioritySupport: false,
      autoRegistration: false,
    },
  },
  tier3: {
    id: 'tier3',
    name: 'Elite',
    prices: {
      weekly: { amount: 2400, label: '$24/wk', period: 'week', stripePriceId: process.env.STRIPE_PRICE_ELITE_WEEKLY || '' },
      monthly: { amount: 7000, label: '$70/mo', period: 'month', stripePriceId: process.env.STRIPE_PRICE_ELITE || '' },
      quarterly: { amount: 18000, label: '$180/qtr', period: 'quarter', stripePriceId: process.env.STRIPE_PRICE_ELITE_QUARTERLY || '' },
      annual: { amount: 60000, label: '$600/yr', period: 'year', stripePriceId: process.env.STRIPE_PRICE_ELITE_ANNUAL || '' },
    },
    scrapeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    dataLevel: 'expert',
    dataLabel: 'Expert Data',
    scheduleLabel: 'Daily',
    trialEnabled: false,
    features: {
      csvExport: true, jsonExport: true, valueScoring: true,
      filteredExport: true, fullTextSearch: true,
      rawDataAccess: true, customFields: true, prioritySupport: true,
      autoRegistration: true,
    },
  },
};

function getTier(tierId) {
  return TIERS[tierId] || TIERS.trial;
}

function getTierPrice(tierId, period) {
  const tier = getTier(tierId);
  if (!tier.prices) return { amount: 0, label: 'Free', period: 'month', stripePriceId: '' };
  return tier.prices[period] || tier.prices.monthly;
}

function getTrialDays(tierId) {
  const tier = getTier(tierId);
  return tier.trialEnabled ? 30 : 0;
}

function getFeatureList(tierId) {
  const tier = getTier(tierId);
  const list = [];
  list.push({ name: 'Scrape Schedule', value: tier.scheduleLabel });
  list.push({ name: 'Data Level', value: tier.dataLabel });
  list.push({ name: 'CSV Export', value: tier.features.csvExport ? '✓' : '✕' });
  list.push({ name: 'JSON Export', value: tier.features.jsonExport ? '✓' : '✕' });
  if (tier.features.valueScoring) list.push({ name: 'Value Scoring', value: '✓' });
  if (tier.features.filteredExport) list.push({ name: 'Filtered Export', value: '✓' });
  if (tier.features.fullTextSearch) list.push({ name: 'Full-Text Search', value: '✓' });
  if (tier.features.rawDataAccess) list.push({ name: 'Raw Data Access', value: '✓' });
  if (tier.features.customFields) list.push({ name: 'Custom Fields', value: '✓' });
  if (tier.features.autoRegistration) list.push({ name: 'Auto-Registration', value: '✓' });
  list.push({ name: 'Priority Support', value: tier.features.prioritySupport ? '✓' : '✕' });
  return list;
}

function getScrapeDays(tierId) {
  return getTier(tierId).scrapeDays;
}

function shouldScrapeToday(tierId) {
  const days = getScrapeDays(tierId);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return days.includes(today);
}

module.exports = { TIERS, getTier, getTierPrice, getTrialDays, getFeatureList, getScrapeDays, shouldScrapeToday };
