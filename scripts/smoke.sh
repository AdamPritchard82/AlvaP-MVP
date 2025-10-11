#!/bin/bash
# Smoke test script for CV parsing deployment
# Usage: ./scripts/smoke.sh [API_BASE_URL]

set -e  # Exit on any error

API_BASE=${1:-"https://natural-kindness-production.up.railway.app"}
echo "🧪 Running smoke tests against: $API_BASE"

# Test 1: Version endpoint
echo "📋 Testing version endpoint..."
VERSION_RESPONSE=$(curl -s "$API_BASE/version")
echo "Version response: $VERSION_RESPONSE"

# Extract parser mode
PARSER_MODE=$(echo "$VERSION_RESPONSE" | grep -o '"parserMode":"[^"]*"' | cut -d'"' -f4)
echo "Parser mode: $PARSER_MODE"

if [ "$PARSER_MODE" = "dummy" ]; then
  echo "❌ FAIL: Dummy parser detected in version endpoint"
  exit 1
fi

# Test 2: Health detailed endpoint
echo "📋 Testing health detailed endpoint..."
HEALTH_RESPONSE=$(curl -s "$API_BASE/health/detailed")
echo "Health response: $HEALTH_RESPONSE"

# Check if health endpoint returns 200
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health/detailed")
if [ "$HEALTH_STATUS" != "200" ]; then
  echo "❌ FAIL: Health detailed endpoint returned $HEALTH_STATUS"
  exit 1
fi

# Check for dummy parser in health response
if echo "$HEALTH_RESPONSE" | grep -q "dummy\|Dummy"; then
  echo "❌ FAIL: Dummy parser detected in health response"
  exit 1
fi

# Test 3: CV parsing (if we have a test file)
if [ -f "fixtures/sample_cv.pdf" ]; then
  echo "📋 Testing CV parsing with sample file..."
  PARSE_RESPONSE=$(curl -s -X POST -F "file=@fixtures/sample_cv.pdf" "$API_BASE/api/candidates/parse-cv")
  echo "Parse response: $PARSE_RESPONSE"
  
  # Check for dummy data
  if echo "$PARSE_RESPONSE" | grep -q "John Doe\|john.doe@example.com"; then
    echo "❌ FAIL: Dummy data detected in parser output"
    exit 1
  fi
  
  # Check for parser unavailable error
  if echo "$PARSE_RESPONSE" | grep -q "ParserUnavailable"; then
    echo "❌ FAIL: Parser unavailable error detected"
    exit 1
  fi
else
  echo "⚠️  No test CV file found at fixtures/sample_cv.pdf - skipping CV parsing test"
fi

# Test 4: Candidate persistence (basic test)
echo "📋 Testing candidate creation..."
CANDIDATE_DATA='{
  "firstName": "Test",
  "lastName": "User",
  "email": "test@example.com",
  "phone": "+44 20 1234 5678",
  "currentTitle": "Test Role",
  "currentEmployer": "Test Company",
  "skills": {
    "communications": true,
    "campaigns": false,
    "policy": true,
    "publicAffairs": false
  }
}'

CREATE_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "$CANDIDATE_DATA" "$API_BASE/api/candidates")
echo "Create response: $CREATE_RESPONSE"

# Extract candidate ID if successful
CANDIDATE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -n "$CANDIDATE_ID" ]; then
  echo "✅ Candidate created with ID: $CANDIDATE_ID"
  
  # Test retrieval
  echo "📋 Testing candidate retrieval..."
  GET_RESPONSE=$(curl -s "$API_BASE/api/candidates/$CANDIDATE_ID")
  echo "Get response: $GET_RESPONSE"
  
  if echo "$GET_RESPONSE" | grep -q "Test User"; then
    echo "✅ Candidate persistence verified"
  else
    echo "❌ FAIL: Candidate not found after creation"
    exit 1
  fi
else
  echo "❌ FAIL: Could not create candidate"
  exit 1
fi

echo "✅ All smoke tests passed!"
