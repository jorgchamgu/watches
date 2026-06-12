import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { brand, model, reference, condition } = req.body
  if (!brand || !model) return res.status(400).json({ error: 'Brand and model required' })

  const condDesc = condition
    ? `Box: ${condition.box ? 'yes' : 'no'}, Papers: ${condition.papers ? 'yes' : 'no'}, Year: ${condition.year || 'unknown'}, Grade: ${condition.grade || 'good'}`
    : 'unknown condition'

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: `You are a luxury watch market expert with deep knowledge of grey market and pre-owned dealer pricing across Europe, North America, and Asia. You know that:
- Dealer street prices are 10-20% below Chrono24 public listings
- Regional price differences exist due to taxes, duties, import costs, and local demand
- Asia (especially Japan/HK/Singapore) often has different premiums than Europe or USA
- Price history shows real market cycles

Respond ONLY with valid JSON, no markdown:
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
  "verdict": "good_buy" | "fair" | "overpriced",
  "verdict_reason": "one clear sentence for a dealer",
  "trend": "up" | "down" | "stable",
  "trend_pct": number,
  "trend_30d": "up" | "down" | "stable",
  "best_platform": "Chrono24" | "WatchBox" | "Direct dealer" | "Auction",
  "best_platform_reason": "one short sentence",
  "regions": {
    "europe": { "buy": number, "sell": number, "note": "one short sentence about EU market" },
    "north_america": { "buy": number, "sell": number, "note": "one short sentence about US market" },
    "asia": { "buy": number, "sell": number, "note": "one short sentence about Asia market" }
  },
  "price_history": [
    { "month": "Jan 24", "price": number },
    { "month": "Feb 24", "price": number },
    { "month": "Mar 24", "price": number },
    { "month": "Apr 24", "price": number },
    { "month": "May 24", "price": number },
    { "month": "Jun 24", "price": number },
    { "month": "Jul 24", "price": number },
    { "month": "Aug 24", "price": number },
    { "month": "Sep 24", "price": number },
    { "month": "Oct 24", "price": number },
    { "month": "Nov 24", "price": number },
    { "month": "Dec 24", "price": number },
    { "month": "Jan 25", "price": number },
    { "month": "Feb 25", "price": number },
    { "month": "Mar 25", "price": number },
    { "month": "Apr 25", "price": number },
    { "month": "May 25", "price": number },
    { "month": "Jun 25", "price": number }
  ],
  "data_points": number,
  "confidence": "high" | "medium" | "low"
}`
        },
        {
          role: 'user',
          content: `Watch: ${brand} ${model}${reference ? ` ref. ${reference}` : ''}
Condition: ${condDesc}

Give realistic dealer street prices with regional breakdowns and 18-month price history. JSON only.`
        }
      ]
    })

    const content = response.choices[0].message.content.trim()
    const clean = content.replace(/```json|```/g, '').trim()
    const pricing = JSON.parse(clean)
    pricing.data_source = 'ai_estimate'

    return res.status(200).json({ success: true, pricing })

  } catch (error) {
    console.error('Pricing error:', error)
    return res.status(500).json({ error: 'Pricing failed' })
  }
}
