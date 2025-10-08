const natural = require('natural');

class SearchService {
  constructor() {
    // Initialize natural language processing tools
    this.stemmer = natural.PorterStemmer;
    this.tokenizer = new natural.WordTokenizer();
    this.tfidf = new natural.TfIdf();
    
    // Search configuration
    this.config = {
      minScore: 0.1,
      maxResults: 100,
      fieldWeights: {
        full_name: 3.0,
        email: 2.0,
        current_title: 2.5,
        current_employer: 2.0,
        notes: 1.0,
        tags: 1.5,
        skills: 1.5
      },
      fuzzyThreshold: 0.6
    };
  }

  // Advanced fuzzy search with relevance scoring
  async searchCandidates(query, candidates, options = {}) {
    if (!query || query.trim().length === 0) {
      return candidates;
    }

    const searchTerms = this.tokenizer.tokenize(query.toLowerCase());
    const stemmedTerms = searchTerms.map(term => this.stemmer.stem(term));
    
    const scoredCandidates = candidates.map(candidate => {
      const score = this.calculateRelevanceScore(candidate, searchTerms, stemmedTerms);
      return { ...candidate, relevanceScore: score };
    });

    // Filter by minimum score and sort by relevance
    const filtered = scoredCandidates
      .filter(candidate => candidate.relevanceScore >= this.config.minScore)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply pagination if specified
    if (options.limit) {
      const offset = (options.page - 1) * options.limit;
      return filtered.slice(offset, offset + options.limit);
    }

    return filtered;
  }

  calculateRelevanceScore(candidate, searchTerms, stemmedTerms) {
    let totalScore = 0;
    let fieldCount = 0;

    // Score each field
    Object.entries(this.config.fieldWeights).forEach(([field, weight]) => {
      const fieldValue = this.getFieldValue(candidate, field);
      if (fieldValue) {
        const fieldScore = this.scoreField(fieldValue, searchTerms, stemmedTerms);
        totalScore += fieldScore * weight;
        fieldCount++;
      }
    });

    // Normalize score
    return fieldCount > 0 ? totalScore / fieldCount : 0;
  }

  getFieldValue(candidate, field) {
    switch (field) {
      case 'full_name':
        return candidate.full_name || '';
      case 'email':
        return candidate.email || '';
      case 'current_title':
        return candidate.current_title || '';
      case 'current_employer':
        return candidate.current_employer || '';
      case 'notes':
        return candidate.notes || '';
      case 'tags':
        return Array.isArray(candidate.tags) ? candidate.tags.join(' ') : '';
      case 'skills':
        if (candidate.skills && typeof candidate.skills === 'object') {
          return Object.entries(candidate.skills)
            .filter(([_, hasSkill]) => hasSkill)
            .map(([skill, _]) => skill)
            .join(' ');
        }
        return '';
      default:
        return '';
    }
  }

  scoreField(fieldValue, searchTerms, stemmedTerms) {
    if (!fieldValue) return 0;

    const fieldTokens = this.tokenizer.tokenize(fieldValue.toLowerCase());
    const fieldStems = fieldTokens.map(token => this.stemmer.stem(token));
    
    let score = 0;

    // Exact match scoring
    searchTerms.forEach(term => {
      if (fieldValue.toLowerCase().includes(term)) {
        score += 1.0;
      }
    });

    // Stemmed match scoring
    stemmedTerms.forEach(stem => {
      fieldStems.forEach(fieldStem => {
        if (fieldStem.includes(stem) || stem.includes(fieldStem)) {
          score += 0.8;
        }
      });
    });

    // Fuzzy matching
    searchTerms.forEach(term => {
      fieldTokens.forEach(token => {
        const similarity = this.calculateSimilarity(term, token);
        if (similarity > this.config.fuzzyThreshold) {
          score += similarity * 0.6;
        }
      });
    });

    // Partial word matching
    searchTerms.forEach(term => {
      fieldTokens.forEach(token => {
        if (token.includes(term) || term.includes(token)) {
          score += 0.4;
        }
      });
    });

    return Math.min(score, 5.0); // Cap at 5.0
  }

  calculateSimilarity(str1, str2) {
    // Levenshtein distance based similarity
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Advanced search suggestions
  generateSearchSuggestions(query, candidates) {
    const suggestions = new Set();
    const queryLower = query.toLowerCase();
    
    candidates.forEach(candidate => {
      // Name suggestions
      if (candidate.full_name && candidate.full_name.toLowerCase().includes(queryLower)) {
        suggestions.add(candidate.full_name);
      }
      
      // Title suggestions
      if (candidate.current_title && candidate.current_title.toLowerCase().includes(queryLower)) {
        suggestions.add(candidate.current_title);
      }
      
      // Employer suggestions
      if (candidate.current_employer && candidate.current_employer.toLowerCase().includes(queryLower)) {
        suggestions.add(candidate.current_employer);
      }
      
      // Tag suggestions
      if (candidate.tags && Array.isArray(candidate.tags)) {
        candidate.tags.forEach(tag => {
          if (tag.toLowerCase().includes(queryLower)) {
            suggestions.add(tag);
          }
        });
      }
    });
    
    return Array.from(suggestions).slice(0, 10);
  }

  // Search analytics
  getSearchAnalytics(searchResults, query) {
    const totalResults = searchResults.length;
    const avgScore = searchResults.reduce((sum, result) => sum + result.relevanceScore, 0) / totalResults;
    const highScoreResults = searchResults.filter(result => result.relevanceScore > 0.7).length;
    
    return {
      query,
      totalResults,
      avgScore: Math.round(avgScore * 100) / 100,
      highScoreResults,
      searchQuality: highScoreResults / totalResults,
      timestamp: new Date().toISOString()
    };
  }

  // Configure search parameters
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return this.config;
  }
}

module.exports = SearchService;
