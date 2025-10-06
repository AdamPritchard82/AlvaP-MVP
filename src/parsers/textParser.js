// Text-based CV parsing utilities extracted from server-hybrid
// Exported so we can lock behavior with simple tests without booting the server

function parseCVContent(text) {
  console.log('Parsing CV content...');
  
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  
  const phoneRegexes = [
    /(\+91\s?[0-9]{4}\s?[0-9]{5})/g,
    /(\+44\s?[0-9]{2,4}\s?[0-9]{3,4}\s?[0-9]{3,4})/g,
    /(\+1\s?[0-9]{3}\s?[0-9]{3}\s?[0-9]{4})/g,
    /(\+[0-9]{1,3}\s?[0-9]{4,5}\s?[0-9]{4,5})/g,
    /(0[0-9]{2,4}\s?[0-9]{3,4}\s?[0-9]{3,4})/g,
    /([0-9]{3}\s?[0-9]{3}\s?[0-9]{4})/g,
    /(\([0-9]{2,4}\)\s?[0-9]{3,4}\s?[0-9]{3,4})/g,
    /([0-9]{10,})/g,
    /(\+?[\d\s\-\(\)]{10,})/g
  ];
  
  let phoneMatch = null;
  const headerText = text.substring(0, 500);
  for (const regex of phoneRegexes) {
    const matches = headerText.match(regex);
    if (matches && matches.length > 0) {
      phoneMatch = matches.reduce((longest, current) => 
        current.replace(/\D/g, '').length > longest.replace(/\D/g, '').length ? current : longest
      );
      break;
    }
  }
  if (!phoneMatch) {
    for (const regex of phoneRegexes) {
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        phoneMatch = matches.reduce((longest, current) => 
          current.replace(/\D/g, '').length > longest.replace(/\D/g, '').length ? current : longest
        );
        break;
      }
    }
  }
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let firstName = '';
  let lastName = '';
  if (lines.length > 0) {
    const firstLine = lines[0];
    const words = firstLine.split(/\s+/);
    if (words.length >= 2) {
      firstName = words[0];
      lastName = words.slice(1).join(' ');
    } else if (words.length === 1) {
      firstName = words[0];
    }
  }
  
  let currentTitle = '';
  let currentEmployer = '';
  const experienceKeywords = ['work experience', 'professional experience', 'employment history', 'career history', 'experience', 'employment', 'work history', 'career'];
  let experienceStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim();
    if (line === 'work experience' || line === 'professional experience') {
      experienceStartIndex = i;
      break;
    }
  }
  if (experienceStartIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.toLowerCase();
      const looksLikeHeader = !/^•/.test(rawLine) && rawLine.length <= 40 && !/[.,;:]/.test(rawLine) && /experience|employment|career/.test(line);
      if (looksLikeHeader && experienceKeywords.some(keyword => line.includes(keyword))) {
        experienceStartIndex = i;
        break;
      }
    }
  }
  if (experienceStartIndex !== -1) {
    for (let i = experienceStartIndex + 1; i < Math.min(experienceStartIndex + 10, lines.length); i++) {
      const line = lines[i];
      if (!line || line.length < 3) continue;
      const jobTitlePatterns = [
        /^([A-Z][a-zA-Z\s&/\-]+(?:Manager|Director|Coordinator|Specialist|Analyst|Consultant|Advisor|Officer|Executive|Lead|Head|Chief|Senior|Junior|Associate|Assistant|Intern|Trainee|Representative|Agent|Clerk|Developer|Engineer|Designer))/i,
        /^([A-Z][a-zA-Z\s&/\-]{3,}(?:\s+[A-Z][a-zA-Z\s&/\-]*)*)/,
        /^([A-Z][a-zA-Z\s&/\-]{4,})/
      ];
      for (const pattern of jobTitlePatterns) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].length > 3) {
          const potentialTitle = match[1].trim();
          const skipPatterns = [
            /^(Government|Westminster|European|Parliament|London|United|Kingdom|UK|England|Scotland|Wales|Northern|Ireland)$/i,
            /^(Address|Phone|Email|Contact|Location|Date|Time|Year|Month|Day)$/i,
            /^(Summary|Objective|Profile|About|Introduction)$/i,
            /^(Education|Qualifications|Skills|Languages|Certifications)$/i,
            /^(References|Referees|Contact|Details)$/i
          ];
          const shouldSkip = skipPatterns.some(skipPattern => skipPattern.test(potentialTitle));
          if (shouldSkip) continue;
          currentTitle = potentialTitle;
          const employerPatterns = [
            /at\s+([A-Z][a-zA-Z\s&.,]+)/i,
            /@\s+([A-Z][a-zA-Z\s&.,]+)/i,
            /,\s+([A-Z][a-zA-Z\s&.,]+)/i
          ];
          for (const empPattern of employerPatterns) {
            const empMatch = line.match(empPattern);
            if (empMatch && empMatch[1] && empMatch[1].length > 2) {
              currentEmployer = empMatch[1].trim();
              break;
            }
          }
          if (!currentEmployer && i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            if (nextLine && nextLine.length > 2 && nextLine.length < 100) {
              currentEmployer = nextLine.trim();
            }
          }
          break;
        }
      }
      if (currentTitle) break;
    }
  }
  if (!currentTitle || !currentEmployer) {
    const headerWindow = lines.slice(0, Math.min(15, lines.length));
    const companySuffixes = /(Limited|Ltd\.?|PLC|LLC|Inc\.?|Incorporated|GmbH|SAS|BV|SA|PTY|Pty\.? Ltd\.?)/i;
    const roleKeywords = /(Manager|Director|Coordinator|Specialist|Analyst|Consultant|Advisor|Officer|Executive|Lead|Head|Chief|Engineer|Developer|Designer|Assistant|Associate)/i;
    const blacklist = /(Government|Parliament|Westminster|European\s+Parliament)/i;
    for (let i = 0; i < headerWindow.length; i++) {
      const line = headerWindow[i];
      if (!line || line.length < 3) continue;
      const patterns = [
        { type: 'title_at_company', rx: /^([A-Z][A-Za-z &/\-]+)\s+at\s+([A-Z][A-Za-z0-9 &.,'\-]+)$/i },
        { type: 'title_comma_company', rx: /^([A-Z][A-Za-z &/\-]+),\s+([A-Z][A-Za-z0-9 &.,'\-]+)$/ },
        { type: 'company_dash_title', rx: /^([A-Z][A-Za-z0-9 &.,'\-]+)\s+[\-\u2013\u2014]\s+([A-Z][A-Za-z &/\-]+)$/ },
        { type: 'title_at_symbol_company', rx: /^([A-Z][A-Za-z &/\-]+)\s+@\s+([A-Z][A-Za-z0-9 &.,'\-]+)$/ }
      ];
      let matched = false;
      for (const { type, rx } of patterns) {
        const m = line.match(rx);
        if (m && m[1] && m[2]) {
          if (type === 'company_dash_title') {
            const candidateEmployer = m[1].trim();
            const candidateTitle = m[2].trim();
            const titleOk = roleKeywords.test(candidateTitle) && !blacklist.test(candidateTitle);
            const employerOk = (!blacklist.test(candidateEmployer)) && (companySuffixes.test(candidateEmployer) || /\b(Company|Group|Ltd|PLC|Inc|LLC|Holdings)\b/i.test(candidateEmployer) || candidateEmployer.split(/\s+/).length >= 2);
            if (titleOk && employerOk) {
              if (!currentEmployer) currentEmployer = candidateEmployer;
              if (!currentTitle) currentTitle = candidateTitle;
              matched = true;
              break;
            }
          } else {
            const candidateTitle = m[1].trim();
            const candidateEmployer = m[2].trim();
            const titleOk = roleKeywords.test(candidateTitle) && !blacklist.test(candidateTitle);
            const employerOk = (!blacklist.test(candidateEmployer)) && (companySuffixes.test(candidateEmployer) || /\b(Company|Group|Ltd|PLC|Inc|LLC|Holdings)\b/i.test(candidateEmployer) || candidateEmployer.split(/\s+/).length >= 2);
            if (titleOk && employerOk) {
              if (!currentTitle) currentTitle = candidateTitle;
              if (!currentEmployer) currentEmployer = candidateEmployer;
              matched = true;
              break;
            }
          }
        }
      }
      if (matched) break;
      if (i + 1 < headerWindow.length && (!currentTitle || !currentEmployer)) {
        const next = headerWindow[i + 1];
        const looksLikeTitle = /^[A-Z][A-Za-z &/\-]{3,}$/.test(line) && !companySuffixes.test(line);
        const looksLikeCompany = /^[A-Z][A-Za-z0-9 &.,'\-]{3,}$/.test(next) && (companySuffixes.test(next) || /\b(Ltd|Limited|Inc|PLC|LLC)\b/i.test(next));
        if (looksLikeTitle && looksLikeCompany) {
          if (!currentTitle) currentTitle = line.trim();
          if (!currentEmployer) currentEmployer = next.trim();
          break;
        }
      }
    }
  }
  
  const textLower = text.toLowerCase();
  const skills = {
    communications: /communications?|comms?|media|press|pr|public relations|marketing/i.test(textLower),
    campaigns: /campaigns?|advocacy|engagement|grassroots|activism|outreach/i.test(textLower),
    policy: /policy|policies|briefing|consultation|legislative|regulatory|government/i.test(textLower),
    publicAffairs: /public affairs|government affairs|parliamentary|stakeholder relations|lobbying/i.test(textLower)
  };
  const tags = [];
  if (skills.communications) tags.push('communications');
  if (skills.campaigns) tags.push('campaigns');
  if (skills.policy) tags.push('policy');
  if (skills.publicAffairs) tags.push('public-affairs');
  const phone = phoneMatch ? phoneMatch.trim() : '';
  return {
    firstName,
    lastName,
    email: emailMatch ? emailMatch[1] : '',
    phone: phone,
    currentTitle,
    currentEmployer,
    skills,
    tags,
    notes: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
    confidence: 0.8
  };
}

module.exports = { parseCVContent };


