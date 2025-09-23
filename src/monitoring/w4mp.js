import cheerio from 'cheerio';
import { fetchText } from './fetch.js';

export async function fetchW4MP({ query = '', page = 1 } = {}) {
  const url = `https://w4mpjobs.org/?job_types=&job_pay_grades=&job_regions=&job_categories=&s=${encodeURIComponent(query)}&paged=${page}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results = [];
  $('.job').each((_, el) => {
    const title = $(el).find('h3 a').text().trim();
    const link = $(el).find('h3 a').attr('href');
    const org = $(el).find('.job__org').text().trim() || $(el).find('.org').text().trim();
    const salary = $(el).find('.job__salary').text().trim() || $(el).find('.salary').text().trim();
    if (title && link) results.push({ title, link, org, salary });
  });
  return results;
}






