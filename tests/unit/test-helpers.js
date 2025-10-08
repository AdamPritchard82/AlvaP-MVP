// Test helpers for business logic validation
// These are minimal, pure functions that mirror production logic

/**
 * Calculate salary band label from salary_min
 * @param {number|null} amount - Salary amount
 * @returns {string|null} - Band label like "£90,000" or null
 */
function toBandLabel(amount) {
  // Handle edge cases safely
  if (amount === null || amount === undefined || amount === '') return null;
  if (isNaN(amount) || Number(amount) <= 0) return null;
  
  const numAmount = Number(amount);
  if (numAmount < 10000) return '£10,000'; // Minimum band
  
  // Round down to nearest £10,000
  const band = Math.floor(numAmount / 10000) * 10000;
  return `£${band.toLocaleString()}`;
}

/**
 * Calculate default salary_max based on salary_min
 * @param {number} salaryMin - Minimum salary
 * @returns {number} - Calculated maximum salary
 */
function calculateDefaultSalaryMax(salaryMin) {
  if (!salaryMin || salaryMin < 100000) {
    return salaryMin + 30000;
  } else {
    return salaryMin + 50000;
  }
}

/**
 * Normalize skill names for consistent handling
 * @param {string} skill - Raw skill name
 * @returns {string} - Normalized skill name
 */
function normalizeSkill(skill) {
  if (!skill || typeof skill !== 'string') return '';
  
  return skill.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z\s]/g, '');
}

/**
 * Check if candidate has required skill
 * @param {Object} candidateSkills - Candidate's skills object
 * @param {string} requiredSkill - Required skill name
 * @returns {boolean} - Whether candidate has the skill
 */
function hasSkill(candidateSkills, requiredSkill) {
  if (!candidateSkills || typeof candidateSkills !== 'object') return false;
  
  const normalized = normalizeSkill(requiredSkill);
  const skillMap = {
    'public affairs': 'publicAffairs',
    'communications': 'communications',
    'policy': 'policy',
    'campaigns': 'campaigns'
  };
  
  const skillKey = skillMap[normalized];
  return skillKey && candidateSkills[skillKey] === true;
}

/**
 * Calculate skill overlap score (0-1)
 * @param {Object} candidateSkills - Candidate's skills
 * @param {Object} jobSkills - Job's required skills
 * @returns {number} - Skill overlap score
 */
function calculateSkillOverlapScore(candidateSkills, jobSkills) {
  if (!candidateSkills || !jobSkills) return 0;
  
  const candidateSkillKeys = Object.keys(candidateSkills).filter(key => candidateSkills[key] === true);
  const jobSkillKeys = Object.keys(jobSkills).filter(key => jobSkills[key] === true);
  
  if (jobSkillKeys.length === 0) return 0;
  
  const overlap = candidateSkillKeys.filter(skill => jobSkillKeys.includes(skill)).length;
  return overlap / jobSkillKeys.length;
}

/**
 * Calculate salary proximity score (0-1)
 * @param {number} candidateMin - Candidate's minimum salary
 * @param {number} candidateMax - Candidate's maximum salary
 * @param {number} jobMin - Job's minimum salary
 * @param {number} jobMax - Job's maximum salary
 * @returns {number} - Salary proximity score
 */
function calculateSalaryProximityScore(candidateMin, candidateMax, jobMin, jobMax) {
  if (!candidateMin || !jobMin) return 0;
  
  // Handle missing candidate max using same logic as banding
  let resolvedCandidateMax = candidateMax;
  if (candidateMin && (candidateMax === null || candidateMax === undefined || Number.isNaN(candidateMax))) {
    resolvedCandidateMax = candidateMin < 100000 ? candidateMin + 30000 : candidateMin + 50000;
  }
  
  // Check if salary ranges overlap
  const candidateRange = [candidateMin, resolvedCandidateMax];
  const jobRange = [jobMin, jobMax];
  
  // Sort ranges
  candidateRange.sort((a, b) => a - b);
  jobRange.sort((a, b) => a - b);
  
  // Check for overlap
  const overlap = Math.max(0, Math.min(candidateRange[1], jobRange[1]) - Math.max(candidateRange[0], jobRange[0]));
  
  if (overlap === 0) return 0; // No overlap
  
  // Calculate proximity score (30% weight for salary)
  const totalRange = Math.max(candidateRange[1], jobRange[1]) - Math.min(candidateRange[0], jobRange[0]);
  const proximityScore = overlap / totalRange;
  
  return proximityScore * 0.3; // 30% weight for salary
}

/**
 * Calculate total match score
 * @param {Object} candidate - Candidate object
 * @param {Object} job - Job object
 * @returns {Object} - Match score details
 */
function calculateMatchScore(candidate, job) {
  if (!candidate || !job) {
    return {
      totalScore: 0,
      skillScore: 0,
      salaryScore: 0
    };
  }
  
  const skillScore = calculateSkillOverlapScore(candidate.skills, job.requiredSkills) * 0.7;
  const salaryScore = calculateSalaryProximityScore(
    candidate.salaryMin, 
    candidate.salaryMax, 
    job.salaryMin, 
    job.salaryMax
  ); // Already includes 30% weight
  
  return {
    totalScore: skillScore + salaryScore,
    skillScore,
    salaryScore
  };
}

module.exports = {
  toBandLabel,
  calculateDefaultSalaryMax,
  normalizeSkill,
  hasSkill,
  calculateSkillOverlapScore,
  calculateSalaryProximityScore,
  calculateMatchScore
};

