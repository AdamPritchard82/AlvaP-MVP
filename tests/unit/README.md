# Unit Tests for Business Logic

This directory contains fast, lightweight unit tests that verify our core business rules without touching production data.

## Test Coverage

### 1. Salary Banding Rules (`salary-banding.test.js`)
- **Band calculation**: `salary_min` rounded down to nearest £10,000
- **Default salary_max**: +£30k when `salary_min < £100k`, +£50k when `salary_min ≥ £100k`
- **Band label formatting**: "£90,000", "£120,000", etc.
- **Edge cases**: Non-numeric, missing, negative values → clear errors, never crash
- **Rounding behavior**: £41,250 → £40,000, £99,999 → £90,000

### 2. Skill Handling (`skill-handling.test.js`)
- **Multi-skill support**: Candidates can belong to multiple skills
- **Skill normalization**: Case/whitespace consistent handling
- **Library grouping**: Uses backend-provided skills, never crashes on empty arrays
- **Edge cases**: Null/undefined skills, malformed data
- **All four categories**: Public Affairs, Communications, Policy, Campaigns

### 3. Role-Candidate Matching (`role-matching.test.js`)
- **Skill overlap**: Candidates must share at least one required skill
- **Salary overlap**: Ranges must overlap using same banding logic
- **Scoring algorithm**: 70% skill overlap + 30% salary proximity
- **Empty results**: Returns empty list when no matches, no errors
- **Edge cases**: Null candidates/jobs, empty skill sets

## Running Tests

```bash
# Run all unit tests
npm run test:unit

# Expected output:
# 🚀 Running Unit Tests for Business Logic
# ✅ All tests passed! Business logic is working correctly.
```

## Test Design Principles

- **Unit-level**: No network calls, no real database
- **Fast**: Run in seconds, stable across environments
- **Deterministic**: Same results every time
- **Isolated**: Don't affect production code paths
- **Readable**: Clear pass/fail messages

## Test Helpers

The `test-helpers.js` file contains pure functions that mirror production business logic:

- `toBandLabel(amount)` - Calculate salary band labels
- `calculateDefaultSalaryMax(salaryMin)` - Default salary max rules
- `normalizeSkill(skill)` - Consistent skill name handling
- `hasSkill(candidateSkills, requiredSkill)` - Skill matching
- `calculateSkillOverlapScore()` - Skill overlap scoring
- `calculateSalaryProximityScore()` - Salary proximity scoring
- `calculateMatchScore(candidate, job)` - Combined match scoring

## What Each Test Suite Validates

### Salary Banding
- ✅ Correct band calculation and rounding
- ✅ Default salary max rules for different salary ranges
- ✅ Proper band label formatting with commas
- ✅ Edge case handling (null, negative, non-numeric)
- ✅ Minimum band enforcement (£10,000)

### Skill Handling
- ✅ Multi-skill candidate support
- ✅ Case-insensitive skill matching
- ✅ Skill name normalization
- ✅ All four skill categories working
- ✅ Graceful handling of malformed data

### Role Matching
- ✅ Skill overlap scoring (0-1 scale)
- ✅ Salary proximity scoring with overlap calculation
- ✅ Combined scoring with correct weights (70% skills, 30% salary)
- ✅ Empty result handling (no crashes)
- ✅ Edge cases (null data, empty skill sets)

## Production Safety

These tests:
- ✅ Don't touch production data
- ✅ Don't modify production code paths
- ✅ Don't require database connections
- ✅ Don't make network requests
- ✅ Run in isolation
- ✅ Are deterministic and fast





