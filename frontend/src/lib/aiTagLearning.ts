// AI Tag Learning System for improving tag suggestions over time
interface TagUsage {
  tag: string;
  count: number;
  lastUsed: number;
  contexts: string[]; // What types of candidates this tag is used with
  successRate: number; // How often this tag leads to successful placements
}

interface CandidateContext {
  skills: string[];
  title: string;
  industry: string;
  salaryRange: string;
  experience: string;
}

interface TagSuggestion {
  tag: string;
  confidence: number;
  reason: string;
}

class AITagLearning {
  private tagUsage: Map<string, TagUsage> = new Map();
  private learningData: {
    successfulPlacements: string[];
    tagPatterns: Map<string, string[]>;
    userPreferences: Map<string, number>;
  } = {
    successfulPlacements: [],
    tagPatterns: new Map(),
    userPreferences: new Map()
  };

  constructor() {
    this.loadFromStorage();
  }

  // Learn from user behavior
  learnFromTagUsage(tag: string, context: CandidateContext, wasSuccessful: boolean = false) {
    const existing = this.tagUsage.get(tag) || {
      tag,
      count: 0,
      lastUsed: 0,
      contexts: [],
      successRate: 0
    };

    existing.count += 1;
    existing.lastUsed = Date.now();
    
    // Add context information
    const contextKey = this.generateContextKey(context);
    if (!existing.contexts.includes(contextKey)) {
      existing.contexts.push(contextKey);
    }

    // Update success rate
    if (wasSuccessful) {
      existing.successRate = (existing.successRate * (existing.count - 1) + 1) / existing.count;
    } else {
      existing.successRate = (existing.successRate * (existing.count - 1)) / existing.count;
    }

    this.tagUsage.set(tag, existing);
    this.saveToStorage();
  }

  // Learn from successful placements
  learnFromPlacement(candidateId: string, tags: string[]) {
    this.learningData.successfulPlacements.push(candidateId);
    
    // Update tag patterns for successful placements
    tags.forEach(tag => {
      const patterns = this.learningData.tagPatterns.get(tag) || [];
      patterns.push(...tags.filter(t => t !== tag));
      this.learningData.tagPatterns.set(tag, patterns);
    });

    this.saveToStorage();
  }

  // Generate smart tag suggestions based on context
  getSuggestions(context: CandidateContext, existingTags: string[] = []): TagSuggestion[] {
    const suggestions: TagSuggestion[] = [];
    const contextKey = this.generateContextKey(context);

    // Get all tags and calculate confidence scores
    for (const [tag, usage] of this.tagUsage) {
      if (existingTags.includes(tag)) continue;

      let confidence = 0;
      let reason = '';

      // Base confidence on usage frequency
      confidence += Math.min(usage.count / 10, 1) * 0.3;

      // Boost confidence for similar contexts
      const similarContexts = usage.contexts.filter(ctx => 
        this.getContextSimilarity(contextKey, ctx) > 0.5
      );
      if (similarContexts.length > 0) {
        confidence += 0.4;
        reason = 'Used with similar candidates';
      }

      // Boost confidence for successful tags
      if (usage.successRate > 0.5) {
        confidence += usage.successRate * 0.3;
        reason = reason ? `${reason}, high success rate` : 'High success rate';
      }

      // Boost confidence for recently used tags
      const daysSinceLastUse = (Date.now() - usage.lastUsed) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUse < 7) {
        confidence += 0.2;
        reason = reason ? `${reason}, recently used` : 'Recently used';
      }

      // Pattern-based suggestions
      const relatedTags = this.learningData.tagPatterns.get(tag) || [];
      const usedRelatedTags = relatedTags.filter(rt => existingTags.includes(rt));
      if (usedRelatedTags.length > 0) {
        confidence += 0.3;
        reason = reason ? `${reason}, often used with ${usedRelatedTags.join(', ')}` : `Often used with ${usedRelatedTags.join(', ')}`;
      }

      // Skill-based suggestions
      if (this.hasSkillMatch(tag, context.skills)) {
        confidence += 0.2;
        reason = reason ? `${reason}, matches skills` : 'Matches candidate skills';
      }

      if (confidence > 0.1) {
        suggestions.push({
          tag,
          confidence: Math.min(confidence, 1),
          reason: reason || 'Based on usage patterns'
        });
      }
    }

    // Sort by confidence and return top suggestions
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8);
  }

  // Get popular tags for quick selection
  getPopularTags(limit: number = 10): string[] {
    return Array.from(this.tagUsage.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(tag => tag.tag);
  }

  // Get trending tags (recently used)
  getTrendingTags(limit: number = 5): string[] {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return Array.from(this.tagUsage.values())
      .filter(tag => tag.lastUsed > oneWeekAgo)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, limit)
      .map(tag => tag.tag);
  }

  // Get tag analytics
  getTagAnalytics() {
    const totalTags = this.tagUsage.size;
    const totalUsage = Array.from(this.tagUsage.values()).reduce((sum, tag) => sum + tag.count, 0);
    const avgSuccessRate = Array.from(this.tagUsage.values()).reduce((sum, tag) => sum + tag.successRate, 0) / totalTags;
    
    return {
      totalTags,
      totalUsage,
      avgSuccessRate,
      mostUsed: this.getPopularTags(5),
      mostSuccessful: Array.from(this.tagUsage.values())
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5)
        .map(tag => ({ tag: tag.tag, successRate: tag.successRate }))
    };
  }

  private generateContextKey(context: CandidateContext): string {
    return `${context.skills.join(',')}-${context.title}-${context.industry}-${context.salaryRange}`;
  }

  private getContextSimilarity(key1: string, key2: string): number {
    const parts1 = key1.split('-');
    const parts2 = key2.split('-');
    
    let matches = 0;
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        matches++;
      }
    }
    
    return matches / Math.max(parts1.length, parts2.length);
  }

  private hasSkillMatch(tag: string, skills: string[]): boolean {
    // Simple skill matching - could be enhanced with more sophisticated NLP
    const skillKeywords = skills.map(s => s.toLowerCase());
    const tagLower = tag.toLowerCase();
    
    return skillKeywords.some(skill => 
      tagLower.includes(skill) || skill.includes(tagLower)
    );
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('alvap-ai-tag-learning');
      if (stored) {
        const data = JSON.parse(stored);
        this.tagUsage = new Map(data.tagUsage || []);
        this.learningData = data.learningData || {
          successfulPlacements: [],
          tagPatterns: new Map(),
          userPreferences: new Map()
        };
      }
    } catch (error) {
      console.error('Failed to load AI tag learning data:', error);
    }
  }

  private saveToStorage() {
    try {
      const data = {
        tagUsage: Array.from(this.tagUsage.entries()),
        learningData: {
          ...this.learningData,
          tagPatterns: Array.from(this.learningData.tagPatterns.entries()),
          userPreferences: Array.from(this.learningData.userPreferences.entries())
        }
      };
      localStorage.setItem('alvap-ai-tag-learning', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save AI tag learning data:', error);
    }
  }
}

// Export singleton instance
export const aiTagLearning = new AITagLearning();
export default aiTagLearning;
