import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://giftly.qa').replace(
  /\/$/,
  '',
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/vendor/',
          '/enterprise/',
          '/business/',
          '/api/',
          '/auth/',
          '/claim/',
          '/reset-password/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
