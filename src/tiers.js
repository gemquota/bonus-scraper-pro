/**
 * Bonus Scraper Pro — Single Plan, Multi-Period Pricing
 *
 * One plan with all features. Choose weekly, monthly, quarterly, or annual billing.
 * Trial: free first month on the monthly plan only.
 */

const MAIN_PLAN = {
  id: 'main',
  name: 'Full Access',
  prices: {
    weekly: { amount: 600, label: '$6/wk', period: 'week', stripePriceId: process.env.STRIPE_PRICE_MAIN_WEEKLY || '' },
    monthly: { amount: 2000, label: '$20/mo', period: 'month', stripePriceId: process.env.STRIPE_PRICE_MAIN_MONTHLY || '' },
    quarterly: { amount: 5000, label: '$50/qtr', period: 'quarter', stripePriceId: process.env.STRIPE_PRICE_MAIN_QUARTERLY || '' },
    annual: { amount: 18000, label: '$180/yr', period: 'year', stripePriceId: process.env.STRIPE_PRICE_MAIN_ANNUAL || '' },
  },
  scrapeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  dataLevel: 'expert',
  dataLabel: 'Expert Data',
  scheduleLabel: 'Daily',
  trialEnabled: true,
  features: {
    csvExport: true, jsonExport: true, valueScoring: true,
    filteredExport: true, fullTextSearch: true,
    rawDataAccess: true, customFields: true, prioritySupport: true,
  },
};

const TRIAL = {
  id: 'trial',
  name: 'Free Trial',
  price: 0,
  scrapeDays: ['Monday'],
  dataLevel: 'basic',
  dataLabel: 'Standard Data',
  scheduleLabel: 'Monday',
  trialEnabled: false,
  features: {
    csvExport: true, jsonExport: false, valueScoring: false,
    filteredExport: false, fullTextSearch: false,
    rawDataAccess: false, customFields: false, prioritySupport: false,
  },
};

// Old tier names that should map to the main plan (backwards compat)
const PAID_TIER_ALIASES = ['main', 'tier1', 'tier2', 'tier3'];

function getTier(tierId) {
  if (PAID_TIER_ALIASES.includes(tierId)) return MAIN_PLAN;
  return TRIAL;
}

function getTierPrice(tierId, period) {
  const tier = getTier(tierId);
  if (!tier.prices) return { amount: 0, label: 'Free', period: 'month', stripePriceId: '' };
  return tier.prices[period] || tier.prices.monthly;
}

function getTrialDays(tierId) {
  // Only monthly period gets a trial
  return 30;
}

function getFeatureList(tierId) {
  const tier = getTier(tierId);
  return [
    { name: 'Scrape Schedule', value: tier.scheduleLabel },
    { name: 'Data Level', value: tier.dataLabel },
    { name: 'CSV Export', value: tier.features.csvExport ? '✓' : '✕' },
    { name: 'JSON Export', value: tier.features.jsonExport ? '✓' : '✕' },
    { name: 'Value Scoring', value: tier.features.valueScoring ? '✓' : '✕' },
    { name: 'Filtered Export', value: tier.features.filteredExport ? '✓' : '✕' },
    { name: 'Full-Text Search', value: tier.features.fullTextSearch ? '✓' : '✕' },
    { name: 'Raw Data Access', value: tier.features.rawDataAccess ? '✓' : '✕' },
    { name: 'Custom Fields', value: tier.features.customFields ? '✓' : '✕' },
    { name: 'Priority Support', value: tier.features.prioritySupport ? '✓' : '✕' },
  ];
}

function getScrapeDays(tierId) {
  return getTier(tierId).scrapeDays;
}

function shouldScrapeToday(tierId) {
  const days = getScrapeDays(tierId);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return days.includes(today);
}

module.exports = { getTier, getTierPrice, getTrialDays, getFeatureList, getScrapeDays, shouldScrapeToday };
