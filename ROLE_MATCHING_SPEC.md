# Role → Candidate Matching Specification

## Overview
Intelligent matching system that connects job roles with suitable candidates based on skills, experience, salary expectations, and other factors.

## Inputs

### Job Role Input
```json
{
  "roleId": "string",
  "title": "string",
  "company": "string",
  "location": "string",
  "salary_range": {
    "min": "number",
    "max": "number"
  },
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "experience_level": "junior|mid|senior|lead",
  "employment_type": "full-time|part-time|contract|freelance",
  "remote_flexibility": "none|partial|full",
  "urgency": "low|medium|high",
  "description": "string",
  "benefits": ["string"],
  "tags": ["string"]
}
```

### Candidate Input
```json
{
  "candidateId": "string",
  "full_name": "string",
  "email": "string",
  "current_title": "string",
  "current_employer": "string",
  "skills": ["string"],
  "salary_expectation": "number",
  "location": "string",
  "experience_years": "number",
  "availability": "immediate|2weeks|1month|flexible",
  "preferred_employment": "full-time|part-time|contract|freelance",
  "remote_preference": "none|partial|full",
  "tags": ["string"],
  "notes": "string"
}
```

## Matching Algorithm

### 1. Skill Matching (40% weight)
- **Exact matches**: Required skills that candidate has
- **Partial matches**: Preferred skills that candidate has
- **Skill relevance**: Using natural language processing for skill synonyms
- **Skill level**: Match experience level with required skills

### 2. Salary Compatibility (25% weight)
- **Range overlap**: Candidate's expectation within role's range
- **Negotiation buffer**: ±10% flexibility for negotiation
- **Market rate**: Compare with industry standards

### 3. Experience Alignment (20% weight)
- **Years of experience**: Match with role requirements
- **Career progression**: Seniority level alignment
- **Domain expertise**: Industry-specific experience

### 4. Location & Remote (10% weight)
- **Geographic proximity**: Distance-based scoring
- **Remote compatibility**: Match remote preferences
- **Relocation willingness**: Factor in candidate mobility

### 5. Cultural & Soft Factors (5% weight)
- **Employment type**: Full-time vs contract preferences
- **Company culture**: Values and work style alignment
- **Career goals**: Growth opportunities match

## Outputs

### Match Score
```json
{
  "candidateId": "string",
  "roleId": "string",
  "overall_score": "number (0-100)",
  "match_breakdown": {
    "skills_score": "number (0-100)",
    "salary_score": "number (0-100)",
    "experience_score": "number (0-100)",
    "location_score": "number (0-100)",
    "cultural_score": "number (0-100)"
  },
  "strengths": ["string"],
  "concerns": ["string"],
  "recommendations": ["string"],
  "match_quality": "excellent|good|fair|poor"
}
```

### Match Ranking
```json
{
  "roleId": "string",
  "total_candidates": "number",
  "matches": [
    {
      "candidateId": "string",
      "score": "number",
      "rank": "number",
      "status": "recommended|consider|review|reject"
    }
  ],
  "summary": {
    "excellent_matches": "number",
    "good_matches": "number",
    "fair_matches": "number",
    "no_matches": "number"
  }
}
```

## API Endpoints

### POST /api/matching/score
Calculate match score between a role and candidate.

**Request:**
```json
{
  "roleId": "role_123",
  "candidateId": "candidate_456"
}
```

**Response:**
```json
{
  "success": true,
  "match": {
    "candidateId": "candidate_456",
    "roleId": "role_123",
    "overall_score": 87,
    "match_breakdown": {
      "skills_score": 92,
      "salary_score": 85,
      "experience_score": 90,
      "location_score": 75,
      "cultural_score": 88
    },
    "strengths": [
      "Perfect skill match for React and Node.js",
      "Salary expectation within range",
      "Strong experience level"
    ],
    "concerns": [
      "Location requires relocation",
      "Prefers remote work"
    ],
    "recommendations": [
      "Consider remote work arrangement",
      "Highlight growth opportunities"
    ],
    "match_quality": "excellent"
  }
}
```

### POST /api/matching/rank-candidates
Rank all candidates for a specific role.

**Request:**
```json
{
  "roleId": "role_123",
  "filters": {
    "min_score": 60,
    "max_candidates": 50,
    "location_preference": "any|local|remote"
  }
}
```

**Response:**
```json
{
  "success": true,
  "roleId": "role_123",
  "total_candidates": 150,
  "matches": [
    {
      "candidateId": "candidate_456",
      "score": 87,
      "rank": 1,
      "status": "recommended"
    },
    {
      "candidateId": "candidate_789",
      "score": 82,
      "rank": 2,
      "status": "recommended"
    }
  ],
  "summary": {
    "excellent_matches": 5,
    "good_matches": 12,
    "fair_matches": 8,
    "no_matches": 125
  }
}
```

### GET /api/matching/suggestions
Get role suggestions for a candidate.

**Request:**
```
GET /api/matching/suggestions?candidateId=candidate_456&limit=10
```

**Response:**
```json
{
  "success": true,
  "candidateId": "candidate_456",
  "suggestions": [
    {
      "roleId": "role_123",
      "title": "Senior React Developer",
      "company": "TechCorp",
      "score": 87,
      "match_reasons": [
        "Strong React and JavaScript skills",
        "Salary expectation aligned",
        "Experience level matches"
      ]
    }
  ]
}
```

## Implementation Notes

### Database Schema
```sql
-- Roles table
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  location VARCHAR(255),
  salary_min INTEGER,
  salary_max INTEGER,
  required_skills JSONB,
  preferred_skills JSONB,
  experience_level VARCHAR(50),
  employment_type VARCHAR(50),
  remote_flexibility VARCHAR(50),
  urgency VARCHAR(20),
  description TEXT,
  benefits JSONB,
  tags JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id),
  candidate_id INTEGER REFERENCES candidates(id),
  overall_score INTEGER,
  skills_score INTEGER,
  salary_score INTEGER,
  experience_score INTEGER,
  location_score INTEGER,
  cultural_score INTEGER,
  match_quality VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Performance Considerations
- **Indexing**: GIN indexes on JSONB fields for fast skill matching
- **Caching**: Cache match scores for frequently accessed role-candidate pairs
- **Batch processing**: Process matches in batches for large datasets
- **Async processing**: Use background jobs for complex matching operations

### Machine Learning Integration
- **Skill synonyms**: Train model on skill name variations
- **Salary prediction**: Use market data to improve salary matching
- **Success prediction**: Learn from successful placements to improve scoring
- **Feedback loop**: Use placement outcomes to refine matching algorithm

## Testing Strategy

### Unit Tests
- Test individual scoring components
- Test edge cases (missing data, extreme values)
- Test algorithm accuracy with known good/bad matches

### Integration Tests
- Test full matching pipeline
- Test API endpoints with real data
- Test performance with large datasets

### A/B Testing
- Compare different scoring weights
- Test algorithm improvements
- Measure placement success rates

## Future Enhancements

### Advanced Features
- **AI-powered matching**: Use machine learning for better predictions
- **Real-time updates**: Update matches when candidate/role data changes
- **Bulk matching**: Process multiple roles/candidates simultaneously
- **Custom scoring**: Allow consultants to adjust scoring weights
- **Match explanations**: Provide detailed reasoning for matches
- **Success tracking**: Track placement outcomes to improve algorithm
