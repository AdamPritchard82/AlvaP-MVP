// Industry presets with roles and skills mappings
// This file contains the predefined industry → roles → skills taxonomy

export const INDUSTRY_PRESETS = {
  'Public Affairs': {
    roles: [
      'Public Affairs Officer',
      'Policy Advisor', 
      'Communications Manager',
      'Campaigns Lead'
    ],
    skillsByRole: {
      'Public Affairs Officer': [
        { name: 'Government Relations', weight: 1 },
        { name: 'Stakeholder Management', weight: 1 },
        { name: 'Policy Analysis', weight: 1 },
        { name: 'Public Speaking', weight: 1 },
        { name: 'Media Relations', weight: 1 },
        { name: 'Strategic Planning', weight: 1 },
        { name: 'Crisis Management', weight: 1 }
      ],
      'Policy Advisor': [
        { name: 'Policy Analysis', weight: 1 },
        { name: 'Research & Writing', weight: 1 },
        { name: 'Legislative Process', weight: 1 },
        { name: 'Data Analysis', weight: 1 },
        { name: 'Stakeholder Engagement', weight: 1 },
        { name: 'Regulatory Affairs', weight: 1 },
        { name: 'Briefing Skills', weight: 1 }
      ],
      'Communications Manager': [
        { name: 'Strategic Communications', weight: 1 },
        { name: 'Media Relations', weight: 1 },
        { name: 'Content Creation', weight: 1 },
        { name: 'Digital Marketing', weight: 1 },
        { name: 'Crisis Communications', weight: 1 },
        { name: 'Brand Management', weight: 1 },
        { name: 'Event Management', weight: 1 }
      ],
      'Campaigns Lead': [
        { name: 'Campaign Strategy', weight: 1 },
        { name: 'Digital Campaigns', weight: 1 },
        { name: 'Volunteer Management', weight: 1 },
        { name: 'Fundraising', weight: 1 },
        { name: 'Grassroots Organizing', weight: 1 },
        { name: 'Political Strategy', weight: 1 },
        { name: 'Event Management', weight: 1 }
      ]
    }
  },
  'Digital Marketing': {
    roles: [
      'SEO Specialist',
      'PPC Manager',
      'Content Strategist',
      'Marketing Manager'
    ],
    skillsByRole: {
      'SEO Specialist': [
        { name: 'Technical SEO', weight: 1 },
        { name: 'Keyword Research', weight: 1 },
        { name: 'Content Optimization', weight: 1 },
        { name: 'Link Building', weight: 1 },
        { name: 'Analytics & Reporting', weight: 1 },
        { name: 'Local SEO', weight: 1 },
        { name: 'E-commerce SEO', weight: 1 }
      ],
      'PPC Manager': [
        { name: 'Google Ads', weight: 1 },
        { name: 'Facebook Ads', weight: 1 },
        { name: 'Campaign Management', weight: 1 },
        { name: 'Bid Optimization', weight: 1 },
        { name: 'A/B Testing', weight: 1 },
        { name: 'Conversion Tracking', weight: 1 },
        { name: 'Budget Management', weight: 1 }
      ],
      'Content Strategist': [
        { name: 'Content Strategy', weight: 1 },
        { name: 'Content Creation', weight: 1 },
        { name: 'SEO Writing', weight: 1 },
        { name: 'Social Media Content', weight: 1 },
        { name: 'Email Marketing', weight: 1 },
        { name: 'Content Calendar', weight: 1 },
        { name: 'Brand Voice', weight: 1 }
      ],
      'Marketing Manager': [
        { name: 'Marketing Strategy', weight: 1 },
        { name: 'Digital Marketing', weight: 1 },
        { name: 'Campaign Management', weight: 1 },
        { name: 'Analytics & Reporting', weight: 1 },
        { name: 'Team Leadership', weight: 1 },
        { name: 'Budget Management', weight: 1 },
        { name: 'Stakeholder Management', weight: 1 }
      ]
    }
  },
  'Tech': {
    roles: [
      'Software Engineer',
      'Product Manager',
      'Data Analyst',
      'DevOps Engineer'
    ],
    skillsByRole: {
      'Software Engineer': [
        { name: 'Programming Languages', weight: 1 },
        { name: 'Software Development', weight: 1 },
        { name: 'System Design', weight: 1 },
        { name: 'Database Management', weight: 1 },
        { name: 'Version Control', weight: 1 },
        { name: 'Testing & QA', weight: 1 },
        { name: 'Problem Solving', weight: 1 }
      ],
      'Product Manager': [
        { name: 'Product Strategy', weight: 1 },
        { name: 'User Research', weight: 1 },
        { name: 'Agile Methodologies', weight: 1 },
        { name: 'Data Analysis', weight: 1 },
        { name: 'Stakeholder Management', weight: 1 },
        { name: 'Roadmap Planning', weight: 1 },
        { name: 'Market Research', weight: 1 }
      ],
      'Data Analyst': [
        { name: 'Data Analysis', weight: 1 },
        { name: 'SQL', weight: 1 },
        { name: 'Python/R', weight: 1 },
        { name: 'Statistical Analysis', weight: 1 },
        { name: 'Data Visualization', weight: 1 },
        { name: 'Machine Learning', weight: 1 },
        { name: 'Business Intelligence', weight: 1 }
      ],
      'DevOps Engineer': [
        { name: 'Cloud Platforms', weight: 1 },
        { name: 'Containerization', weight: 1 },
        { name: 'CI/CD', weight: 1 },
        { name: 'Infrastructure as Code', weight: 1 },
        { name: 'Monitoring & Logging', weight: 1 },
        { name: 'Security', weight: 1 },
        { name: 'Automation', weight: 1 }
      ]
    }
  },
  'Healthcare': {
    roles: [
      'Clinical Recruiter',
      'Practice Manager',
      'Compliance Officer',
      'Health Policy Analyst'
    ],
    skillsByRole: {
      'Clinical Recruiter': [
        { name: 'Healthcare Recruitment', weight: 1 },
        { name: 'Clinical Knowledge', weight: 1 },
        { name: 'Credentialing', weight: 1 },
        { name: 'Regulatory Compliance', weight: 1 },
        { name: 'Candidate Assessment', weight: 1 },
        { name: 'Relationship Building', weight: 1 },
        { name: 'Market Knowledge', weight: 1 }
      ],
      'Practice Manager': [
        { name: 'Healthcare Operations', weight: 1 },
        { name: 'Staff Management', weight: 1 },
        { name: 'Financial Management', weight: 1 },
        { name: 'Regulatory Compliance', weight: 1 },
        { name: 'Patient Care Coordination', weight: 1 },
        { name: 'Quality Improvement', weight: 1 },
        { name: 'Technology Integration', weight: 1 }
      ],
      'Compliance Officer': [
        { name: 'Regulatory Compliance', weight: 1 },
        { name: 'Risk Management', weight: 1 },
        { name: 'Audit & Investigation', weight: 1 },
        { name: 'Policy Development', weight: 1 },
        { name: 'Training & Education', weight: 1 },
        { name: 'Documentation', weight: 1 },
        { name: 'Legal Knowledge', weight: 1 }
      ],
      'Health Policy Analyst': [
        { name: 'Policy Analysis', weight: 1 },
        { name: 'Healthcare Systems', weight: 1 },
        { name: 'Research & Writing', weight: 1 },
        { name: 'Data Analysis', weight: 1 },
        { name: 'Stakeholder Engagement', weight: 1 },
        { name: 'Regulatory Affairs', weight: 1 },
        { name: 'Program Evaluation', weight: 1 }
      ]
    }
  },
  'Finance': {
    roles: [
      'Compliance Analyst',
      'Investor Relations',
      'Financial PR Manager'
    ],
    skillsByRole: {
      'Compliance Analyst': [
        { name: 'Regulatory Compliance', weight: 1 },
        { name: 'Risk Assessment', weight: 1 },
        { name: 'Financial Regulations', weight: 1 },
        { name: 'Audit & Investigation', weight: 1 },
        { name: 'Documentation', weight: 1 },
        { name: 'Reporting', weight: 1 },
        { name: 'Training & Education', weight: 1 }
      ],
      'Investor Relations': [
        { name: 'Financial Communications', weight: 1 },
        { name: 'Investor Relations', weight: 1 },
        { name: 'Financial Analysis', weight: 1 },
        { name: 'Presentation Skills', weight: 1 },
        { name: 'Market Knowledge', weight: 1 },
        { name: 'Relationship Management', weight: 1 },
        { name: 'Crisis Communications', weight: 1 }
      ],
      'Financial PR Manager': [
        { name: 'Financial Communications', weight: 1 },
        { name: 'Media Relations', weight: 1 },
        { name: 'Crisis Communications', weight: 1 },
        { name: 'Content Creation', weight: 1 },
        { name: 'Stakeholder Management', weight: 1 },
        { name: 'Brand Management', weight: 1 },
        { name: 'Event Management', weight: 1 }
      ]
    }
  },
  'Nonprofit': {
    roles: [
      'Advocacy Officer',
      'Programme Manager',
      'Fundraising Manager'
    ],
    skillsByRole: {
      'Advocacy Officer': [
        { name: 'Advocacy Strategy', weight: 1 },
        { name: 'Policy Analysis', weight: 1 },
        { name: 'Campaign Management', weight: 1 },
        { name: 'Stakeholder Engagement', weight: 1 },
        { name: 'Coalition Building', weight: 1 },
        { name: 'Public Speaking', weight: 1 },
        { name: 'Research & Writing', weight: 1 }
      ],
      'Programme Manager': [
        { name: 'Program Management', weight: 1 },
        { name: 'Project Planning', weight: 1 },
        { name: 'Budget Management', weight: 1 },
        { name: 'Team Leadership', weight: 1 },
        { name: 'Stakeholder Management', weight: 1 },
        { name: 'Monitoring & Evaluation', weight: 1 },
        { name: 'Grant Management', weight: 1 }
      ],
      'Fundraising Manager': [
        { name: 'Fundraising Strategy', weight: 1 },
        { name: 'Donor Relations', weight: 1 },
        { name: 'Grant Writing', weight: 1 },
        { name: 'Event Management', weight: 1 },
        { name: 'Digital Fundraising', weight: 1 },
        { name: 'Volunteer Management', weight: 1 },
        { name: 'Relationship Building', weight: 1 }
      ]
    }
  }
};

// Helper function to get all available industries
export function getAvailableIndustries() {
  return Object.keys(INDUSTRY_PRESETS);
}

// Helper function to get roles for selected industries
export function getRolesForIndustries(industries) {
  const allRoles = new Set();
  industries.forEach(industry => {
    if (INDUSTRY_PRESETS[industry]) {
      INDUSTRY_PRESETS[industry].roles.forEach(role => allRoles.add(role));
    }
  });
  return Array.from(allRoles);
}

// Helper function to get skills for a specific role
export function getSkillsForRole(industry, role) {
  if (INDUSTRY_PRESETS[industry] && INDUSTRY_PRESETS[industry].skillsByRole[role]) {
    return INDUSTRY_PRESETS[industry].skillsByRole[role];
  }
  return [];
}

// Helper function to get all skills for multiple roles
export function getSkillsForRoles(industry, roles) {
  const allSkills = new Map();
  roles.forEach(role => {
    const skills = getSkillsForRole(industry, role);
    skills.forEach(skill => {
      if (!allSkills.has(skill.name)) {
        allSkills.set(skill.name, skill);
      }
    });
  });
  return Array.from(allSkills.values());
}
