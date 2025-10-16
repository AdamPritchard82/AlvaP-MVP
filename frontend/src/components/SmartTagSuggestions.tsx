import React, { useState, useEffect } from 'react';
import { Tag, Sparkles, TrendingUp, Star, Clock, X } from 'lucide-react';
import { aiTagLearning, TagSuggestion } from '../lib/aiTagLearning';

interface SmartTagSuggestionsProps {
  context: {
    skills: string[];
    title: string;
    industry: string;
    salaryRange: string;
    experience: string;
  };
  existingTags: string[];
  onTagSelect: (tag: string) => void;
  onTagRemove?: (tag: string) => void;
  className?: string;
}

export default function SmartTagSuggestions({
  context,
  existingTags,
  onTagSelect,
  onTagRemove,
  className = ''
}: SmartTagSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, [context, existingTags]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const [smartSuggestions, popular, trending] = await Promise.all([
        Promise.resolve(aiTagLearning.getSuggestions(context, existingTags)),
        Promise.resolve(aiTagLearning.getPopularTags(6)),
        Promise.resolve(aiTagLearning.getTrendingTags(4))
      ]);
      
      setSuggestions(smartSuggestions);
      setPopularTags(popular);
      setTrendingTags(trending);
    } catch (error) {
      console.error('Failed to load tag suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.7) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence > 0.4) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence > 0.7) return <Star className="h-3 w-3" />;
    if (confidence > 0.4) return <TrendingUp className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center text-sm text-gray-600">
          <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
          Loading AI suggestions...
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* AI Smart Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <div className="flex items-center mb-3">
            <Sparkles className="h-4 w-4 text-purple-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-900">AI Suggestions</h4>
            <span className="ml-2 text-xs text-gray-500">({suggestions.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.tag}
                onClick={() => onTagSelect(suggestion.tag)}
                className={`inline-flex items-center px-3 py-1.5 text-sm border rounded-full transition-colors hover:shadow-sm ${getConfidenceColor(suggestion.confidence)}`}
                title={suggestion.reason}
              >
                {getConfidenceIcon(suggestion.confidence)}
                <span className="ml-1">{suggestion.tag}</span>
                <span className="ml-1 text-xs opacity-75">
                  {Math.round(suggestion.confidence * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <div>
          <div className="flex items-center mb-3">
            <TrendingUp className="h-4 w-4 text-blue-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-900">Popular Tags</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {popularTags
              .filter(tag => !existingTags.includes(tag))
              .slice(0, 6)
              .map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagSelect(tag)}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Trending Tags */}
      {trendingTags.length > 0 && (
        <div>
          <div className="flex items-center mb-3">
            <Clock className="h-4 w-4 text-orange-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-900">Trending</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingTags
              .filter(tag => !existingTags.includes(tag))
              .map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagSelect(tag)}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-full hover:bg-orange-100 transition-colors"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {tag}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Selected Tags */}
      {existingTags.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Selected Tags</h4>
            <span className="text-xs text-gray-500">{existingTags.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {existingTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1.5 text-sm text-white bg-blue-600 rounded-full"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
                {onTagRemove && (
                  <button
                    onClick={() => onTagRemove(tag)}
                    className="ml-2 p-0.5 hover:bg-blue-700 rounded-full transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No suggestions message */}
      {suggestions.length === 0 && popularTags.length === 0 && trendingTags.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No tag suggestions available yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Start adding tags to help AI learn your preferences
          </p>
        </div>
      )}
    </div>
  );
}
