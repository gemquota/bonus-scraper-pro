#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

echo "╔══════════════════════════════════════════════╗"
echo "║  Bonus Scraper Pro — Full Stripe Setup      ║"
echo "║  Creates 12 prices: 3 tiers × 4 periods     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    source <(grep -E '^STRIPE_SECRET_KEY=' "$ENV_FILE" || true)
  fi
fi

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  echo "❌ STRIPE_SECRET_KEY is not set."
  echo "   Get your key at https://dashboard.stripe.com/apikeys"
  exit 1
fi

STRIPE_API="https://api.stripe.com/v1"

stripe_api() {
  local method="$1"; local path="$2"; local data="$3"
  curl -s -X "$method" "$STRIPE_API$path" -u "$STRIPE_SECRET_KEY:" ${data:+-d "$data"}
}

create_price() {
  local name="$1" desc="$2" amount="$3" interval="$4" interval_count="$5"
  local product=$(stripe_api POST /products "name=Bonus+Scraper+Pro+${name}&description=${desc}")
  local prod_id=$(echo "$product" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  local price=$(stripe_api POST /prices "currency=usd&product=${prod_id}&unit_amount=${amount}&recurring[interval]=${interval}&recurring[interval_count]=${interval_count}")
  echo "$price" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"
}

echo "🔧 Creating 12 prices (3 tiers × 4 periods)..."
echo ""

# Starter: $6/wk $20/mo $50/qtr $180/yr
# Pro:     $12/wk $35/mo $90/qtr $300/yr
# Elite:   $24/wk $70/mo $180/qtr $600/yr

PRICES=(
  "Starter+Weekly|Weekly+Monday+scrape|600|week|1"
  "Starter|Monthly+Monday+scrape|2000|month|1"
  "Starter+Quarterly|Quarterly+Monday+scrape|5000|month|3"
  "Starter+Annual|Annual+Monday+scrape|18000|year|1"
  "Pro+Weekly|Weekly+Mon+Thu+Sat+scrape|1200|week|1"
  "Pro|Monthly+Mon+Thu+Sat+scrape|3500|month|1"
  "Pro+Quarterly|Quarterly+Mon+Thu+Sat+scrape|9000|month|3"
  "Pro+Annual|Annual+Mon+Thu+Sat+scrape|30000|year|1"
  "Elite+Weekly|Weekly+Daily+scrape|2400|week|1"
  "Elite|Monthly+Daily+scrape|7000|month|1"
  "Elite+Quarterly|Quarterly+Daily+scrape|18000|month|3"
  "Elite+Annual|Annual+Daily+scrape|60000|year|1"
)

VARS=(
  STRIPE_PRICE_STARTER_WEEKLY
  STRIPE_PRICE_STARTER
  STRIPE_PRICE_STARTER_QUARTERLY
  STRIPE_PRICE_STARTER_ANNUAL
  STRIPE_PRICE_PRO_WEEKLY
  STRIPE_PRICE_PRO
  STRIPE_PRICE_PRO_QUARTERLY
  STRIPE_PRICE_PRO_ANNUAL
  STRIPE_PRICE_ELITE_WEEKLY
  STRIPE_PRICE_ELITE
  STRIPE_PRICE_ELITE_QUARTERLY
  STRIPE_PRICE_ELITE_ANNUAL
)

i=0
for price_def in "${PRICES[@]}"; do
  IFS='|' read -r name desc amount interval interval_count <<< "$price_def"
  var="${VARS[$i]}"
  echo -n "  $((i+1))/12 $name... "
  price_id=$(create_price "$name" "$desc" "$amount" "$interval" "$interval_count")
  echo "$price_id"
  eval "$var=$price_id"
  i=$((i+1))
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ All 12 prices created!                  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

if [ -f "$ENV_FILE" ]; then
  for var in STRIPE_PRICE_STARTER STRIPE_PRICE_PRO STRIPE_PRICE_ELITE \
             STRIPE_PRICE_STARTER_WEEKLY STRIPE_PRICE_STARTER_QUARTERLY STRIPE_PRICE_STARTER_ANNUAL \
             STRIPE_PRICE_PRO_WEEKLY STRIPE_PRICE_PRO_QUARTERLY STRIPE_PRICE_PRO_ANNUAL \
             STRIPE_PRICE_ELITE_WEEKLY STRIPE_PRICE_ELITE_QUARTERLY STRIPE_PRICE_ELITE_ANNUAL; do
    sed -i "/^${var}=/d" "$ENV_FILE" 2>/dev/null || true
  done
  for var in "${VARS[@]}"; do echo "${var}=${!var}" >> "$ENV_FILE"; done
  echo "📝 $ENV_FILE updated automatically!"
else
  echo "📝  Save these to $ENV_FILE:"
  for var in "${VARS[@]}"; do echo "  ${var}=${!var}"; done
fi

echo ""
echo "🔧 Next steps:"
echo "   1. Set STRIPE_WEBHOOK_SECRET in .env"
echo "   2. Deploy server: npm start"
echo "   3. Visit https://your-app.com/pricing"
echo ""
