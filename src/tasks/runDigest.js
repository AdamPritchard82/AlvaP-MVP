import 'dotenv/config';
import { initDatabase, getDb } from '../db.js';
import { sendEmail } from '../email/sender.js';
import { fetchCharityJob } from '../monitoring/charityjob.js';
import { fetchW4MP } from '../monitoring/w4mp.js';
import { fetchIndeed } from '../monitoring/indeed.js';
import { upsertFromResults } from './utils.js';

export default async function runDigest() {
  initDatabase();
  const db = getDb();
  const keywords = [
    'Public Affairs',
    'Government Affairs',
    'Corporate Communications',
    'Crisis Communications',
    'Campaign',
    'Policy'
  ];

  const results = [];
  for (const kw of keywords) {
    // eslint-disable-next-line no-await-in-loop
    const [cj, w4, ind] = await Promise.all([
      fetchCharityJob({ query: kw, page: 1 }),
      fetchW4MP({ query: kw, page: 1 }),
      fetchIndeed({ query: kw, page: 0 })
    ]);
    results.push(...(cj || []), ...(w4 || []), ...(ind || []));
  }

  const { insertedIds, count } = upsertFromResults(db, results);

  const since = new Date(Date.now() - 24*60*60*1000).toISOString();
  const newJobs = db.prepare('SELECT id, title, source FROM jobs WHERE created_at >= ? ORDER BY created_at DESC').all(since);
  const users = db.prepare("SELECT email, name FROM users WHERE role IN ('consultant','admin')").all();

  if (newJobs.length && users.length) {
    const list = newJobs.map(j => `- ${j.title}\n  ${j.source}`).join('\n');
    const subject = `Daily CRM digest: ${newJobs.length} new jobs`;
    const html = `<p>${newJobs.length} new jobs</p><ul>${newJobs.map(j => `<li><a href="${j.source}">${j.title}</a></li>`).join('')}</ul>`;
    for (const u of users) {
      // eslint-disable-next-line no-await-in-loop
      await sendEmail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to: u.email, subject, html, text: list });
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ inserted: insertedIds.length, recipients: users.length }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDigest().catch(err => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}


