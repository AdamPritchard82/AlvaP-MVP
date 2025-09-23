import cheerio from 'cheerio';
import { fetchText } from './fetch.js';

// Simple public search scrape; subject to Indeed changes/limits.
export async function fetchIndeed({ query = 'public affairs', location = 'United Kingdom', page = 0 } = {}) {
  const q = encodeURIComponent(query);
  const l = encodeURIComponent(location);
  const start = page * 10;
  const url = `https://uk.indeed.com/jobs?q=${q}&l=${l}&start=${start}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results = [];
  $('a.tapItem').each((_, el) => {
    const title = $(el).find('h2.jobTitle span').last().text().trim();
    const link = 'https://uk.indeed.com' + ($(el).attr('href') || '');
    const org = $(el).find('.companyName').text().trim();
    const salary = $(el).find('.salary-snippet-container').text().trim();
    if (title && link.includes('/rc/clk')) results.push({ title, link, org, salary });
  });
  return results;
}






