import fs from 'node:fs/promises';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import natural from 'natural';
import { NlpManager } from 'node-nlp';

function extractEmails(text) {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches));
}

function extractPhones(text) {
  // UK/EU style numbers and general international formats
  const matches = text.match(/(?:(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4})/g) || [];
  // Filter obvious false positives (short strings, too many letters)
  const cleaned = matches.map(s => s.replace(/[^\d+]/g, ''))
    .filter(s => s.replace(/\D/g, '').length >= 9);
  return Array.from(new Set(cleaned));
}

function extractNames(text) {
  // Enhanced name extraction using NLP
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  // Look for common name patterns in first few lines
  for (const line of lines.slice(0, 15)) {
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      // Check if line starts with capital letters (name pattern)
      if (/^[A-Z]/.test(line)) {
        // Filter out common non-name words
        const filteredWords = words.filter(word => 
          !/^(CV|Resume|Curriculum|Vitae|Profile|Contact|Email|Phone|Address|Mobile|Tel|Fax|LinkedIn|Twitter|Website|Web|www|http|https|@|\.com|\.co\.uk|\.org|\.net)$/i.test(word)
        );
        if (filteredWords.length >= 2) {
          return filteredWords.join(' ');
        }
      }
    }
  }
  
  // Fallback: use NLP tokenizer to find proper nouns
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text);
  const properNouns = [];
  
  for (let i = 0; i < Math.min(tokens.length, 50); i++) {
    const token = tokens[i];
    if (/^[A-Z][a-z]+$/.test(token) && token.length > 2) {
      properNouns.push(token);
      if (properNouns.length >= 2) break;
    }
  }
  
  return properNouns.join(' ');
}

export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = await fs.readFile(filePath);
  if (ext === '.pdf') {
    const res = await pdfParse(buf);
    return res.text || '';
  }
  if (ext === '.docx') {
    const res = await mammoth.extractRawText({ buffer: buf });
    return res.value || '';
  }
  // Fallback: treat as text
  return buf.toString('utf8');
}

export async function parseCv(filePath) {
  const text = await extractText(filePath);
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const fullName = extractNames(text);

  // Enhanced job title and employer extraction
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const titles = [];
  const employers = [];
  
  // Common job title patterns
  const titlePatterns = [
    /\b(manager|director|officer|lead|consultant|head|advisor|adviser|specialist|coordinator|executive|analyst|researcher|strategist|policy|communications|campaigns|public affairs)\b/i,
    /\b(senior|principal|associate|junior|graduate|trainee|intern|volunteer)\s+\w+/i,
    /\b(chief|deputy|assistant|vice)\s+\w+/i
  ];
  
  // Common employer patterns
  const employerPatterns = [
    /\b(ltd|limited|llp|plc|inc|gmbh|foundation|charity|association|cic|council|department|ministry|government|parliament|westminster|whitehall)\b/i,
    /\b(consultancy|consulting|agency|group|holdings|partners|solutions|services|international|global|european|uk|british)\b/i
  ];
  
  for (const line of lines.slice(0, 200)) {
    // Extract job titles
    for (const pattern of titlePatterns) {
      if (pattern.test(line) && line.length > 5 && line.length < 100) {
        // Clean up the title
        const cleanTitle = line.replace(/[^\w\s\-&]/g, '').trim();
        if (cleanTitle.length > 3) {
          titles.push(cleanTitle);
        }
      }
    }
    
    // Extract employers
    for (const pattern of employerPatterns) {
      if (pattern.test(line) && line.length > 5 && line.length < 150) {
        // Clean up the employer name
        const cleanEmployer = line.replace(/[^\w\s\-&.,]/g, '').trim();
        if (cleanEmployer.length > 3) {
          employers.push(cleanEmployer);
        }
      }
    }
  }
  
  // Remove duplicates and sort by length (longer titles/employers are usually more specific)
  const uniqueTitles = Array.from(new Set(titles))
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);
  const uniqueEmployers = Array.from(new Set(employers))
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);

  // Enhanced skill detection using NLP and semantic analysis
  const lower = text.toLowerCase();
  
  // Define skill keywords with weights
  const skillKeywords = {
    communications: [
      'communications', 'comms', 'media relations', 'press', 'pr', 'public relations',
      'marketing communications', 'content creation', 'social media', 'digital marketing',
      'stakeholder communications', 'internal communications', 'external communications',
      'brand management', 'reputation management', 'crisis communications'
    ],
    campaigns: [
      'campaign', 'campaigns', 'advocacy', 'engagement', 'grassroots', 'community organizing',
      'political campaigns', 'election campaigns', 'awareness campaigns', 'fundraising campaigns',
      'digital campaigns', 'social media campaigns', 'email campaigns', 'voter engagement',
      'mobilization', 'activism', 'lobbying', 'petition', 'protest'
    ],
    policy: [
      'policy', 'policies', 'briefing', 'consultation', 'legislative', 'regulatory',
      'government relations', 'public policy', 'policy analysis', 'policy development',
      'research', 'analysis', 'evaluation', 'monitoring', 'compliance', 'governance',
      'strategy', 'strategic planning', 'impact assessment', 'stakeholder engagement'
    ],
    publicAffairs: [
      'public affairs', 'government affairs', 'parliamentary', 'stakeholder relations',
      'political affairs', 'institutional relations', 'regulatory affairs', 'public sector',
      'ministry', 'department', 'civil service', 'public administration', 'government',
      'parliament', 'westminster', 'whitehall', 'ministerial', 'cabinet', 'mps'
    ]
  };
  
  function scoreFor(keywords) {
    let totalScore = 0;
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(lower);
    
    for (const keyword of keywords) {
      // Exact phrase matching
      const phraseMatches = (lower.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      totalScore += phraseMatches * 2;
      
      // Individual word matching with stemming
      const keywordWords = keyword.split(/\s+/);
      for (const word of keywordWords) {
        const stemmedWord = natural.PorterStemmer.stem(word);
        for (const token of tokens) {
          const stemmedToken = natural.PorterStemmer.stem(token);
          if (stemmedToken === stemmedWord) {
            totalScore += 1;
          }
        }
      }
    }
    
    // Normalize score to 0-5 scale
    if (totalScore === 0) return 0;
    if (totalScore <= 2) return 1;
    if (totalScore <= 4) return 2;
    if (totalScore <= 8) return 3;
    if (totalScore <= 15) return 4;
    return 5;
  }
  
  const inferredSkills = {
    communications: scoreFor(skillKeywords.communications),
    campaigns: scoreFor(skillKeywords.campaigns),
    policy: scoreFor(skillKeywords.policy),
    publicAffairs: scoreFor(skillKeywords.publicAffairs)
  };

  return {
    fullName,
    email: emails[0] || '',
    phone: phones[0] || '',
    titles: uniqueTitles,
    employers: uniqueEmployers,
    dates: [],
    inferredSkills,
    rawLength: text.length
  };
}




