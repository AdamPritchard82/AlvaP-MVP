// AI CV One-liner Generator for creating compelling candidate summaries
interface CandidateData {
  full_name: string;
  current_title: string;
  current_employer: string;
  skills: { [key: string]: number };
  salary_min?: number;
  salary_max?: number;
  experience?: string;
  tags: string[];
  notes?: string;
}

interface OneLinerOptions {
  style: 'professional' | 'casual' | 'technical' | 'executive';
  length: 'short' | 'medium' | 'long';
  focus: 'skills' | 'experience' | 'achievements' | 'potential';
}

interface OneLinerResult {
  oneLiner: string;
  confidence: number;
  style: string;
  focus: string;
}

class AICVOneLinerGenerator {
  private templates = {
    professional: {
      short: [
        "{name} is a {title} at {company} with expertise in {skills}.",
        "{name} brings {experience} of experience in {industry} to the role.",
        "Experienced {title} {name} with strong background in {skills}."
      ],
      medium: [
        "{name} is an accomplished {title} at {company}, bringing {experience} of experience and expertise in {skills} to drive {outcomes}.",
        "With {experience} in {industry}, {name} has developed strong skills in {skills} and a track record of {achievements}.",
        "Experienced {title} {name} combines {skills} expertise with {experience} of industry experience at {company}."
      ],
      long: [
        "{name} is a seasoned {title} with {experience} of experience in {industry}, currently at {company}. They bring deep expertise in {skills} and have demonstrated success in {achievements}, making them an ideal candidate for {roles}.",
        "An accomplished {title}, {name} has {experience} of experience in {industry} and currently serves at {company}. Their expertise spans {skills} and they have a proven track record of {achievements}, positioning them well for {roles}."
      ]
    },
    casual: {
      short: [
        "{name} is a {title} who's great at {skills}.",
        "Meet {name} - a {title} with {experience} of experience in {skills}.",
        "{name} brings fresh energy and {skills} skills to the table."
      ],
      medium: [
        "{name} is a talented {title} at {company} who's passionate about {skills} and has {experience} of experience to back it up.",
        "With {experience} under their belt, {name} has become really good at {skills} and loves working in {industry}.",
        "{name} is the kind of {title} who gets things done - they're skilled in {skills} and have {experience} of experience to prove it."
      ],
      long: [
        "{name} is a dynamic {title} with {experience} of experience who's made their mark in {industry}. Currently at {company}, they're known for their {skills} skills and their ability to {achievements}. They'd be perfect for {roles}.",
        "Meet {name} - a {title} who's been crushing it in {industry} for {experience}. At {company}, they've built up serious skills in {skills} and have a reputation for {achievements}. They're ready to take on {roles}."
      ]
    },
    technical: {
      short: [
        "{name} is a {title} specializing in {skills} with {experience} of experience.",
        "Technical {title} {name} brings {skills} expertise to {company}.",
        "{name} combines {skills} technical skills with {experience} of industry experience."
      ],
      medium: [
        "{name} is a technical {title} at {company} with {experience} of experience in {skills} and a proven ability to {achievements}.",
        "With {experience} of technical experience, {name} has developed expertise in {skills} and demonstrated success in {achievements}.",
        "Technical specialist {name} brings {skills} skills and {experience} of experience to drive {outcomes} at {company}."
      ],
      long: [
        "{name} is a technical {title} with {experience} of experience in {industry}, currently at {company}. They possess deep technical expertise in {skills} and have successfully {achievements}, making them an ideal candidate for technical {roles}.",
        "A technical expert with {experience} of experience, {name} has built their career in {industry} and currently serves as {title} at {company}. Their technical skills span {skills} and they have a track record of {achievements} in technical {roles}."
      ]
    },
    executive: {
      short: [
        "{name} is a senior {title} with {experience} of leadership experience in {industry}.",
        "Executive {title} {name} brings {experience} of experience and {skills} expertise.",
        "{name} is a seasoned {title} with proven success in {skills} and {experience} of experience."
      ],
      medium: [
        "{name} is a senior {title} at {company} with {experience} of leadership experience in {industry} and expertise in {skills}.",
        "With {experience} of executive experience, {name} has led {achievements} and developed strong capabilities in {skills}.",
        "Senior {title} {name} combines {skills} expertise with {experience} of leadership experience and a track record of {achievements}."
      ],
      long: [
        "{name} is a senior {title} with {experience} of leadership experience in {industry}, currently at {company}. They bring executive-level expertise in {skills} and have successfully {achievements}, positioning them as an ideal candidate for senior {roles}.",
        "A seasoned executive with {experience} of experience, {name} has built their career in {industry} and currently serves as {title} at {company}. Their executive expertise spans {skills} and they have a proven track record of {achievements} in senior {roles}."
      ]
    }
  };

  private skillCategories = {
    communications: ['communication', 'PR', 'media relations', 'content strategy', 'stakeholder engagement'],
    campaigns: ['campaign management', 'digital marketing', 'event planning', 'volunteer coordination', 'fundraising'],
    policy: ['policy analysis', 'legislative affairs', 'government relations', 'regulatory compliance', 'research'],
    publicAffairs: ['public affairs', 'government relations', 'lobbying', 'advocacy', 'political strategy']
  };

  private industryKeywords = {
    'Public Affairs': ['policy', 'government', 'political', 'regulatory', 'stakeholder'],
    'Communications': ['communication', 'PR', 'media', 'content', 'brand'],
    'Campaigns': ['campaign', 'political', 'election', 'grassroots', 'volunteer'],
    'Policy': ['policy', 'research', 'analysis', 'legislative', 'regulatory'],
    'Healthcare': ['healthcare', 'medical', 'pharmaceutical', 'clinical', 'health policy'],
    'Technology': ['tech', 'digital', 'software', 'innovation', 'technology'],
    'Finance': ['financial', 'banking', 'investment', 'compliance', 'risk'],
    'Energy': ['energy', 'renewable', 'sustainability', 'environmental', 'climate'],
    'Education': ['education', 'academic', 'learning', 'curriculum', 'student'],
    'Non-Profit': ['nonprofit', 'advocacy', 'community', 'social impact', 'mission']
  };

  generateOneLiner(candidate: CandidateData, options: OneLinerOptions = {
    style: 'professional',
    length: 'medium',
    focus: 'skills'
  }): OneLinerResult {
    const template = this.selectTemplate(candidate, options);
    const variables = this.extractVariables(candidate, options);
    const oneLiner = this.fillTemplate(template, variables);
    const confidence = this.calculateConfidence(candidate, options);

    return {
      oneLiner,
      confidence,
      style: options.style,
      focus: options.focus
    };
  }

  generateMultipleOptions(candidate: CandidateData): OneLinerResult[] {
    const options = [
      { style: 'professional' as const, length: 'short' as const, focus: 'skills' as const },
      { style: 'professional' as const, length: 'medium' as const, focus: 'experience' as const },
      { style: 'casual' as const, length: 'medium' as const, focus: 'skills' as const },
      { style: 'technical' as const, length: 'medium' as const, focus: 'skills' as const },
      { style: 'executive' as const, length: 'long' as const, focus: 'achievements' as const }
    ];

    return options.map(option => this.generateOneLiner(candidate, option));
  }

  private selectTemplate(candidate: CandidateData, options: OneLinerOptions): string {
    const templates = this.templates[options.style][options.length];
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }

  private extractVariables(candidate: CandidateData, options: OneLinerOptions): { [key: string]: string } {
    const activeSkills = Object.entries(candidate.skills)
      .filter(([_, level]) => level > 0)
      .map(([skill, _]) => skill);

    const skillsText = this.formatSkills(activeSkills);
    const experience = this.formatExperience(candidate.experience);
    const industry = this.detectIndustry(candidate);
    const company = candidate.current_employer || 'their current organization';
    const achievements = this.generateAchievements(candidate, options.focus);
    const outcomes = this.generateOutcomes(candidate);
    const roles = this.generateRoles(candidate);

    return {
      name: candidate.full_name,
      title: candidate.current_title || 'professional',
      company: company,
      skills: skillsText,
      experience: experience,
      industry: industry,
      achievements: achievements,
      outcomes: outcomes,
      roles: roles
    };
  }

  private formatSkills(skills: string[]): string {
    if (skills.length === 0) return 'various professional skills';
    if (skills.length === 1) return skills[0];
    if (skills.length === 2) return `${skills[0]} and ${skills[1]}`;
    if (skills.length === 3) return `${skills[0]}, ${skills[1]}, and ${skills[2]}`;
    return `${skills.slice(0, -1).join(', ')}, and ${skills[skills.length - 1]}`;
  }

  private formatExperience(experience?: string): string {
    if (!experience) return 'extensive';
    
    // Try to extract years from experience string
    const yearMatch = experience.match(/(\d+)\s*years?/i);
    if (yearMatch) {
      const years = parseInt(yearMatch[1]);
      if (years >= 10) return 'over 10 years';
      if (years >= 5) return '5+ years';
      if (years >= 3) return '3+ years';
      return `${years} years`;
    }
    
    return experience.toLowerCase();
  }

  private detectIndustry(candidate: CandidateData): string {
    const title = candidate.current_title?.toLowerCase() || '';
    const company = candidate.current_employer?.toLowerCase() || '';
    const notes = candidate.notes?.toLowerCase() || '';
    
    const text = `${title} ${company} ${notes}`;
    
    for (const [industry, keywords] of Object.entries(this.industryKeywords)) {
      if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        return industry;
      }
    }
    
    return 'their field';
  }

  private generateAchievements(candidate: CandidateData, focus: string): string {
    const achievements = [
      'delivering results',
      'driving growth',
      'leading teams',
      'implementing strategies',
      'building relationships',
      'solving complex problems',
      'exceeding targets',
      'managing projects'
    ];
    
    return achievements[Math.floor(Math.random() * achievements.length)];
  }

  private generateOutcomes(candidate: CandidateData): string {
    const outcomes = [
      'successful outcomes',
      'positive results',
      'strategic initiatives',
      'organizational growth',
      'team development',
      'process improvement'
    ];
    
    return outcomes[Math.floor(Math.random() * outcomes.length)];
  }

  private generateRoles(candidate: CandidateData): string {
    const roles = [
      'leadership positions',
      'senior roles',
      'strategic positions',
      'management opportunities',
      'executive positions'
    ];
    
    return roles[Math.floor(Math.random() * roles.length)];
  }

  private fillTemplate(template: string, variables: { [key: string]: string }): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    
    return result;
  }

  private calculateConfidence(candidate: CandidateData, options: OneLinerOptions): number {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence for complete data
    if (candidate.full_name) confidence += 0.1;
    if (candidate.current_title) confidence += 0.1;
    if (candidate.current_employer) confidence += 0.1;
    if (candidate.experience) confidence += 0.1;
    
    // Boost confidence for active skills
    const activeSkills = Object.values(candidate.skills).filter(level => level > 0).length;
    confidence += Math.min(activeSkills * 0.05, 0.2);
    
    // Boost confidence for tags
    if (candidate.tags.length > 0) confidence += Math.min(candidate.tags.length * 0.02, 0.1);
    
    // Boost confidence for salary data
    if (candidate.salary_min || candidate.salary_max) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }
}

// Export singleton instance
export const aiCVOneLinerGenerator = new AICVOneLinerGenerator();
export default aiCVOneLinerGenerator;
