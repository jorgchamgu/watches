import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function scrapeChronoPrice(brand, model, reference) {
  try {
    const query = [brand, model, reference].filter(Boolean).join(' ')
    const encodedQuery = encodeURIComponent(query)
    
    const response = await fetch(
      `https://api.apify.com/v2/acts/epctex~chrono24-scraper/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}&maxItems=10`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: query,
          maxItems: 10
        })
      }
    )
    
    if (!response.ok) return null
    const items = await response.json()
    if (!items || items.length === 0) return null
    
    const prices = items
      .map(i => i.price)
      .filter(p => p && p > 0)
      .sort((a, b) => a - b)
    
    if (prices.length === 0) return null
    
    return {
      min: prices[0],
      max: prices[prices.length - 1],
      median: prices[Math.floor(prices.length / 2)],
      count: prices.length,
      source: 'chrono24'
    }
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { brand, model, reference, condition, year } = req.body

  if (!brand || !model) {
    return res.status(400).json({ error: 'Brand and model required' })
  }

  // Try real Chrono24 data first if Apify token is available
  let marketData = null
  if (process.env.APIFY_TOKEN) {
    marketData = await scrapeChronoPrice(brand, model, reference)
  }

  try {
    const conditionDesc = condition
      ? `Box: ${condition.box ? 'yes' : 'no'}, Papers: ${condition.papers ? 'yes' : 'no'}, Year: ${condition.year || 'unknown'}, Grade: ${condition.grade || 'good'}`
      : 'condition unknown'

    const marketContext = marketData
      ? `Real Chrono24 market data: min listing €${marketData.min}, max €${marketData.max}, median €${marketData.median}, based on ${marketData.count} active listings.`
      : 'No real-time data available, use your training knowledge of watch market prices as of early 2025.'

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `You are a luxury watch market expert specialising in grey market and pre-owned dealer pricing. You know the real prices that independent dealers trade at — typically 10-20% below Chrono24 public listings.

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "dealer_buy_price": number,
  "dealer_sell_price": number,
  "margin": number,
  "margin_pct": number,
  "price_min": number,
  "price_max": number,
  "retail_price": number,
  "discount_vs_retail": number,
  "active_listings": number,
  "trend": "up" | "down" | "stable",
  "trend_pct": number,
  "trend_30d": "up" | "down" | "stable",
  "verdict": "good_buy" | "fair" | "overpriced",
  "verdict_reason": "one clear sentence for a dealer",
  "best_platform": "Chrono24" | "WatchBox" | "Direct dealer" | "Auction",
  "best_platform_reason": "one short sentence",
  "data_points": number,
  "confidence": "high" | "medium" | "low"
}`
        },
        {
          role: 'user',
          content: `Watch: ${brand} ${model}${reference ? ` ref. ${reference}` : ''}
Condition: ${conditionDesc}
${marketContext}

Give realistic dealer street prices (what dealers actually pay each other, not Chrono24 listing prices). JSON only.`
        }
      ]
    })

    const content = response.choices[0].message.content.trim()
    const clean = content.replace(/```json|```/g, '').trim()
    const pricing = JSON.parse(clean)

    // Tag data source
    pricing.data_source = marketData ? 'chrono24_live' : 'ai_estimate'

    return res.status(200).json({ success: true, pricing })

  } catch (error) {
    console.error('Pricing error:', error)
    return res.status(500).json({ error: 'Pricing failed' })
  }
}
