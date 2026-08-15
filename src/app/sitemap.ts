import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.quillfox.cc';
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: baseUrl + '/pricing', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: baseUrl + '/privacy', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
    { url: baseUrl + '/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 }
  ];
}
