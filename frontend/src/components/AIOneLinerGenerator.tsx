import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Copy, Check, Settings, Zap } from 'lucide-react';
import { aiCVOneLinerGenerator, OneLinerResult, OneLinerOptions } from '../lib/aiCVOneliners';

interface AIOneLinerGeneratorProps {
  candidate: {
    full_name: string;
    current_title: string;
    current_employer: string;
    skills: { [key: string]: number };
    salary_min?: number;
    salary_max?: number;
    experience?: string;
    tags: string[];
    notes?: string;
  };
  onOneLinerSelect?: (oneLiner: string) => void;
  className?: string;
}

export default function AIOneLinerGenerator({ 
  candidate, 
  onOneLinerSelect,
  className = '' 
}: AIOneLinerGeneratorProps) {
  const [oneLiners, setOneLiners] = useState<OneLinerResult[]>([]);
  const [selectedOneLiner, setSelectedOneLiner] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [customOptions, setCustomOptions] = useState<OneLinerOptions>({
    style: 'professional',
    length: 'medium',
    focus: 'skills'
  });

  useEffect(() => {
    generateOneLiners();
  }, [candidate]);

  const generateOneLiners = async () => {
    setLoading(true);
    try {
      const results = aiCVOneLinerGenerator.generateMultipleOptions(candidate);
      setOneLiners(results);
      if (results.length > 0) {
        setSelectedOneLiner(results[0].oneLiner);
      }
    } catch (error) {
      console.error('Failed to generate one-liners:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCustom = async () => {
    setLoading(true);
    try {
      const result = aiCVOneLinerGenerator.generateOneLiner(candidate, customOptions);
      setOneLiners(prev => [result, ...prev]);
      setSelectedOneLiner(result.oneLiner);
      setShowOptions(false);
    } catch (error) {
      console.error('Failed to generate custom one-liner:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const handleSelect = (oneLiner: string) => {
    setSelectedOneLiner(oneLiner);
    onOneLinerSelect?.(oneLiner);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence > 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence > 0.8) return <Zap className="h-3 w-3" />;
    if (confidence > 0.6) return <Sparkles className="h-3 w-3" />;
    return <Settings className="h-3 w-3" />;
  };

  if (loading && oneLiners.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center text-sm text-gray-600">
          <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
          Generating AI one-liners...
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Sparkles className="h-5 w-5 text-purple-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">AI One-liners</h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={generateOneLiners}
            disabled={loading}
            className="flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center px-3 py-1.5 text-sm text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Settings className="h-4 w-4 mr-1" />
            Custom
          </button>
        </div>
      </div>

      {/* Custom Options */}
      {showOptions && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Custom Generation Options</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Style</label>
              <select
                value={customOptions.style}
                onChange={(e) => setCustomOptions(prev => ({ ...prev, style: e.target.value as any }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="technical">Technical</option>
                <option value="executive">Executive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Length</label>
              <select
                value={customOptions.length}
                onChange={(e) => setCustomOptions(prev => ({ ...prev, length: e.target.value as any }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Focus</label>
              <select
                value={customOptions.focus}
                onChange={(e) => setCustomOptions(prev => ({ ...prev, focus: e.target.value as any }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="skills">Skills</option>
                <option value="experience">Experience</option>
                <option value="achievements">Achievements</option>
                <option value="potential">Potential</option>
              </select>
            </div>
          </div>
          <button
            onClick={generateCustom}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Generate Custom
          </button>
        </div>
      )}

      {/* One-liners List */}
      <div className="space-y-3">
        {oneLiners.map((result, index) => (
          <div
            key={index}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedOneLiner === result.oneLiner
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => handleSelect(result.oneLiner)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-gray-900 mb-2">{result.oneLiner}</p>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full border ${getConfidenceColor(result.confidence)}`}>
                    {getConfidenceIcon(result.confidence)}
                    <span className="ml-1">{Math.round(result.confidence * 100)}% confidence</span>
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{result.style}</span>
                  <span className="text-xs text-gray-500 capitalize">{result.length}</span>
                  <span className="text-xs text-gray-500 capitalize">{result.focus}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(result.oneLiner, `copy-${index}`);
                }}
                className="ml-3 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                {copied === `copy-${index}` ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Selected One-liner */}
      {selectedOneLiner && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-900">Selected One-liner</h4>
            <button
              onClick={() => handleCopy(selectedOneLiner, 'selected')}
              className="flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              {copied === 'selected' ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="text-blue-900 font-medium">{selectedOneLiner}</p>
        </div>
      )}

      {/* No one-liners message */}
      {oneLiners.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No one-liners generated yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Regenerate" to create AI-powered summaries
          </p>
        </div>
      )}
    </div>
  );
}
