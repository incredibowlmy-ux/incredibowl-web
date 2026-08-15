/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.incredibowl.my',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  // /member* covers the ZH /member but NOT /en/member (different prefix), so it
  // is listed explicitly. Member pages are noindex,follow account pages — keep
  // them out of the sitemap. /meal-vouchers + legal pages stay (self-canonical,
  // indexable).
  // /driver + /track are the delivery-tracking internal/private pages (noindex).
  // /o + /en/o are the WhatsApp bot's deep-link order landing pages: noindex by
  // metadata, entered ONLY via a link BowlMama sends. Listing a noindex URL in
  // the sitemap makes Search Console flag "Submitted URL marked noindex", and a
  // bare /o would compete with / and /order for the same intent.
  // ⚠️ Exact strings, NOT '/o*' — that glob would swallow /order and /en/order.
  exclude: ['/admin*', '/checkout*', '/member*', '/en/member*', '/account*', '/login*', '/icon.png', '/dashboard-*', '/driver*', '/track*', '/o', '/en/o'],
  robotsTxtOptions: {
    policies: [
      // Default policy for all crawlers (Google, Bing, DuckDuckGo, etc.)
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'],
      },
      // Explicitly allow LLM training & retrieval crawlers — required for
      // ChatGPT / Claude / Perplexity / Google AI Overviews to recommend us
      // when users ask about Old Klang Road / Pearl Point food delivery.
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'ClaudeBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'Claude-Web', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'PerplexityBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'Google-Extended', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'CCBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
      { userAgent: 'Bytespider', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-', '/driver', '/track'] },
    ],
  },
}
