/**
 * Bonus Scraper Pro — Multi-Period Pricing
 * 
 * Tiers with weekly, monthly, quarterly, and annual billing.
 * Trial: free first month on Starter only.
 */

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
  elite: process.env.STRIPE_PRICE_ENTERPRISE || '',
};

// Store additional price IDs for different periods
const PERIOD_PRICES = {
  starter_weekly: process.env.STRIPE_PRICE_STARTER_WEEKLY || '',
  starter_monthly: PRICE_IDS.starter,
  starter_quarterly: process.env.STRIPE_PRICE_STARTER_QUARTERLY || '',
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL || '',
  pro_weekly: process.env.STRIPE_PRICE_PRO_WEEKLY || '',
  pro_monthly: PRICE_IDS.pro,
  pro_quarterly: process.env.STRIPE_PRICE_PRO_QUARTERLY || '',
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL || '',
  elite_weekly: process.env.STRIPE_PRICE_ELITE_WEEKLY || '',
  elite_monthly: PRICE_IDS.elite,
  elite_quarterly: process.env.STRIPE_PRICE_ELITE_QUARTERLY || '',
  elite_annual: process.env.STRIPE_PRICE_ELITE_ANNUAL || '',
};

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
    trialEnabled: false,  // No trial for trial itself
    features: {
      csvExport: true, jsonExport: false, valueScoring: false,
      filteredExport: false, fullTextSearch: false,
      rawDataAccess: false, customFields: false, prioritySupport: false,
    },
  },
  tier1: {
    id: 'tier1',
    name: 'Starter',
    prices: {
      weekly: { amount: 1200, label: '$12/wk', period: 'week', stripePriceId: PERIOD_PRICES.starter_weekly },
      monthly: { amount: 4700, label: '$47/mo', period: 'month', stripePriceId: PERIOD_PRICES.starter_monthly },
      quarterly: { amount: 12000, label: '$120/qtr', period: 'quarter', stripePriceId: PERIOD_PRICES.starter_quarterly },
      annual: { amount: 40000, label: '$400/yr', period: 'year', stripePriceId: PERIOD_PRICES.starter_annual },
    },
    scrapeDays: ['Monday'],
    dataLevel: 'basic',
    dataLabel: 'Standard Data',
    scheduleLabel: 'Monday',
    trialEnabled: true,  // Free first month on Starter
    features: {
      csvExport: true, jsonExport: false, valueScoring: false,
      filteredExport: false, fullTextSearch: false,
      rawDataAccess: false, customFields: false, prioritySupport: false,
    },
  },
  tier2: {
    id: 'tier2',
    name: 'Pro',
    prices: {
      weekly: { amount: 2500, label: '$25/wk', period: 'week', stripePriceId: PERIOD_PRICES.pro_weekly },
      monthly: { amount: 9700, label: '$97/mo', period: 'month', stripePriceId: PERIOD_PRICES.pro_monthly },
      quarterly: { amount: 25000, label: '$250/qtr', period: 'quarter', stripePriceId: PERIOD_PRICES.pro_quarterly },
      annual: { amount: 84000, label: '$840/yr', period: 'year', stripePriceId: PERIOD_PRICES.pro_annual },
    },
    scrapeDays: ['Thursday', 'Saturday', 'Monday'],
    dataLevel: 'advanced',
    dataLabel: 'Advanced Data',
    scheduleLabel: 'Mon + Thu + Sat',
    trialEnabled: false,
    features: {
      csvExport: true, jsonExport: true, valueScoring: true,
      filteredExport: true, fullTextSearch: false,
      rawDataAccess: false, customFields: false, prioritySupport: false,
    },
  },
  tier3: {
    id: 'tier3',
    name: 'Elite',
    prices: {
      weekly: { amount: 5000, label: '$50/wk', period: 'week', stripePriceId: PERIOD_PRICES.elite_weekly },
      monthly: { amount: 19700, label: '$197/mo', period: 'month', stripePriceId: PERIOD_PRICES.elite_monthly },
      quarterly: { amount: 50000, label: '$500/qtr', period: 'quarter', stripePriceId: PERIOD_PRICES.elite_quarterly },
      annual: { amount: 160000, label: '$1,600/yr', period: 'year', stripePriceId: PERIOD_PRICES.elite_annual },
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
