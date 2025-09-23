import cheerio from 'cheerio';
import { fetchText } from './fetch.js';

export async function fetchCharityJob({ query = 'public affairs', location = '', page = 1 } = {}) {
  const q = encodeURIComponent(query);
  const url = `https://www.charityjob.co.uk/jobs?keywords=${q}&page=${page}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results = [];
  $('.job-result').each((_, el) => {
    const title = $(el).find('h3 a').text().trim();
    const link = $(el).find('h3 a').attr('href');
    const org = $(el).find('.job-result__company').text().trim();
    const salary = $(el).find('.job-result__salary').text().trim();
    if (title && link) results.push({ title, link: link.startsWith('http') ? link : `https://www.charityjob.co.uk${link}`, org, salary });
  });
  return results;
}






