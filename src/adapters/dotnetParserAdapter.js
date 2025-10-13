// Adapter for .NET parser response - handles both camelCase and PascalCase
// and maps to most recent role for jobTitle/company

const pick = (o, keys) => { 
  for (const k of keys) if (o && o[k] != null) return o[k]; 
  return null;
};

function normaliseDotnet(raw) {
  const data = pick(raw, ['data', 'Data']) || {};
  const pi = pick(data, ['personalInfo', 'PersonalInfo']) || {};
  const we = pick(data, ['workExperience', 'WorkExperience']) || [];

  const pickMostRecentRole = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return {};
    
    const scored = arr.map(r => ({
      r, 
      s: (r.endDate == null ? 3 : 0) + 
         (Date.parse(r.endDate || 0) || 0) / 1e12 + 
         (Date.parse(r.startDate || 0) || 0) / 1e12
    }));
    
    scored.sort((a, b) => b.s - a.s);
    const best = scored.find(x => 
      (x.r.company || x.r.Company) && (x.r.jobTitle || x.r.JobTitle)
    )?.r || scored[0]?.r || {};
    
    return best;
  };

  const role = pickMostRecentRole(we);

  return {
    name: pick(pi, ['name', 'Name']),
    firstName: pick(pi, ['firstName', 'FirstName']),
    lastName: pick(pi, ['lastName', 'LastName']),
    email: pick(pi, ['email', 'Email']),
    phone: pick(pi, ['phone', 'Phone']),
    jobTitle: pick(role, ['jobTitle', 'JobTitle']),
    employer: pick(role, ['company', 'Company']),
    _raw: raw,
  };
}

module.exports = { normaliseDotnet };
