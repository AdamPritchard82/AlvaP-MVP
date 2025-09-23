import cheerio from 'cheerio';
import { fetchText } from './fetch.js';

// LinkedIn job pages are often protected; this is best-effort and may fail.
export async function fetchLinkedIn({ query = 'public affairs', location = 'United Kingdom', start = 0 } = {}) {
  const q = encodeURIComponent(query);
  const l = encodeURIComponent(location);
  const url = `https://www.linkedin.com/jobs/search?keywords=${q}&location=${l}&start=${start}`;
  try {
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const results = [];
    $('[data-occludable-job-id]').each((_, el) => {
      const title = $(el).find('.base-search-card__title').text().trim();
      const org = $(el).find('.base-search-card__subtitle').text().trim();
      const link = $(el).find('a.base-card__full-link').attr('href');
      const salary = '';
      if (title && link) results.push({ title, link, org, salary });
    });
    return results;
  } catch {
    return [];
  }
}












