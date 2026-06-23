/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.incredibowl.my',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  // /member* covers the ZH /member but NOT /en/member (different prefix), so it
  // is listed explicitly. Member pages are noindex,follow account pages — keep
  // them out of the sitemap. /meal-vouchers + legal pages stay (self-canonical,
  // indexable).
  exclude: ['/admin*', '/checkout*', '/member*', '/en/member*', '/account*', '/login*', '/icon.png', '/dashboard-*'],
  robotsTxtOptions: {
    policies: [
      // Default policy for all crawlers (Google, Bing, DuckDuckGo, etc.)
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'],
      },
      // Explicitly allow LLM training & retrieval crawlers — required for
      // ChatGPT / Claude / Perplexity / Google AI Overviews to recommend us
      // when users ask about Old Klang Road / Pearl Point food delivery.
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'ClaudeBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'Claude-Web', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'PerplexityBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'Google-Extended', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'CCBot', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
      { userAgent: 'Bytespider', allow: '/', disallow: ['/admin', '/checkout', '/member', '/account', '/login', '/api', '/dashboard-'] },
    ],
  },
}
