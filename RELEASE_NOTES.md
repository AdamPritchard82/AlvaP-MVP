# Release Notes - Door 10 MVP v2.0

## 🎯 What's New

### Library Feature - 3-Level Candidate Browsing
- **Skills Grid**: Browse candidates by skill category (Public Affairs, Communications, Policy, Campaigns)
- **Salary Bands**: Filter by salary ranges within each skill (£80,000, £90,000, etc.)
- **Candidate Lists**: View filtered candidates with pagination and search
- **Smart Navigation**: Breadcrumb navigation between levels

### Enhanced Candidate Management
- **Improved CV Parsing**: Robust email, phone, and skill extraction
- **Salary Banding**: Automatic salary band calculation and labeling
- **Multi-skill Support**: Candidates can belong to multiple skill categories
- **Persistent Storage**: PostgreSQL with SQLite fallback for reliability

### Advanced Search & Matching
- **Fuzzy Search**: Intelligent candidate search with suggestions
- **Role Matching**: 70% skill overlap + 30% salary proximity scoring
- **Export Functionality**: CSV/PDF export with filtering
- **Performance Optimized**: Fast queries with server-side pagination

## 🔧 Technical Improvements

### Backend Resilience
- **Database Fallback**: PostgreSQL primary with SQLite fallback
- **Error Handling**: Consistent JSON responses, never crashes on null fields
- **Rate Limiting**: Friendly rate limits with clear headers
- **Timing Logs**: Concise performance monitoring

### Frontend Integration
- **Consistent Navigation**: Both sidebar and direct routes lead to same Library view
- **Search Integration**: Original search bar + new Library tiles
- **Responsive Design**: Works across all screen sizes
- **Loading States**: Clear feedback during data operations

## 📊 Business Rules Implemented

### Salary Banding
- Bands calculated from `salary_min` rounded down to nearest £10,000
- Default `salary_max`: +£30k when < £100k, +£50k when ≥ £100k
- Band labels: "£80,000", "£90,000", etc.
- Edge case handling: Non-numeric, missing, negative values

### Skill Handling
- Multi-skill candidates supported
- Consistent normalization (case/whitespace)
- Library grouping uses backend-provided skills
- Never crashes on empty/missing arrays

### Role Matching
- Candidates must share at least one required skill
- Salary ranges must overlap using same banding logic
- Scoring: 70% skill overlap + 30% salary proximity
- Returns empty list when no matches (no errors)

## 🚀 Performance Features

### Query Optimization
- Server-side pagination (max 100 per page)
- Efficient database queries with proper indexing
- Fast Library skill/band calculations
- Optimized search with fuzzy matching

### Export Capabilities
- CSV export with custom column selection
- PDF export (simplified text-based)
- Filtered exports based on Library selections
- Automatic file cleanup after download

## 🔒 Security & Reliability

### Rate Limiting
- General endpoints: 100 requests per 15 minutes
- Candidate creation: 10 requests per 15 minutes
- CV parsing: 5 requests per 15 minutes
- Friendly error messages with retry guidance

### Error Handling
- Consistent JSON error responses
- Graceful fallbacks for database issues
- Null-safe JSON parsing
- Global error handlers prevent crashes

## 📋 Known Limitations

### Current Constraints
- **CV Parsing**: Basic text extraction (no advanced NLP)
- **PDF Export**: Simplified text-based format
- **Search**: Single-term queries (no complex boolean)
- **Matching**: Basic skill/salary scoring (no ML)

### Database Considerations
- **SQLite Fallback**: In-memory storage during PostgreSQL outages
- **Data Persistence**: Candidates may be lost during server restarts if using fallback
- **Migration**: Manual database schema updates required

### Performance Notes
- **Large Datasets**: Library calculations may slow with 1000+ candidates
- **Export Limits**: Max 1000 records per export
- **Search**: Full-text search limited to basic string matching

## 🎯 What Works Right Now

### Core Functionality
✅ **CV Upload & Parsing**: Extract name, email, phone, skills, salary
✅ **Candidate Creation**: Save with validation and error handling
✅ **Library Navigation**: Skills → Bands → Candidates flow
✅ **Search & Filter**: Find candidates by name, skills, salary
✅ **Export**: Download filtered candidate lists as CSV/PDF
✅ **Health Monitoring**: Server status and subsystem checks

### User Experience
✅ **Responsive UI**: Works on desktop and mobile
✅ **Loading States**: Clear feedback during operations
✅ **Error Messages**: User-friendly error handling
✅ **Navigation**: Intuitive Library browsing
✅ **Performance**: Fast page loads and searches

## 🔄 Migration Notes

### From Previous Version
- **No Breaking Changes**: All existing functionality preserved
- **New Routes**: `/candidates` now shows Library view
- **Enhanced Data**: Salary banding and multi-skill support
- **Improved Parsing**: Better CV extraction accuracy

### Database Schema
- **New Fields**: `band_label`, enhanced `skills` object
- **Backward Compatible**: Existing candidates work with new features
- **Automatic Migration**: Schema updates applied on startup

## 🚀 Deployment Ready

### Production Features
- **Health Checks**: `/health` endpoint for monitoring
- **Rate Limiting**: Prevents abuse and ensures stability
- **Error Recovery**: Graceful handling of edge cases
- **Performance Logs**: Timing information for optimization
- **CORS Security**: Proper cross-origin request handling

### Monitoring
- **Request Timing**: All endpoints log response times
- **Error Tracking**: Comprehensive error logging
- **Database Status**: Connection health monitoring
- **Rate Limit Headers**: Clear rate limit information

---

**Version**: 2.0  
**Release Date**: October 2025  
**Compatibility**: Node.js 18+, PostgreSQL 12+ (with SQLite fallback)  
**Frontend**: React 18+, Tailwind CSS 3+
