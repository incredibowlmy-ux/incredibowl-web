/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.incredibowl.my',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  exclude: ['/admin*', '/checkout*', '/member*', '/account*', '/login*', '/icon.png'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/checkout', '/member', '/account', '/login'],
      },
    ],
  },
}
