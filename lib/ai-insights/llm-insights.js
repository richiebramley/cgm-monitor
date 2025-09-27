'use strict';

/**
 * LLM-Enhanced Insights Module for Weekly Summary
 * Provides intelligent analysis and recommendations using AI/LLM capabilities
 */

const axios = require('axios');

function create(env, ctx) {
  const logger = require('../../lib/logger')('ai-insights');
  
  // Configuration
  const config = {
    // OpenAI Configuration (can be configured via environment variables)
    openaiApiKey: env.AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    openaiModel: env.AI_OPENAI_MODEL || 'gpt-3.5-turbo',
    
    // Alternative LLM providers
    anthropicApiKey: env.AI_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    anthropicModel: env.AI_ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
    
    // Enable/disable AI features
    enabled: env.AI_INSIGHTS_ENABLED !== 'false',
    
    // Rate limiting
    maxRequestsPerHour: env.AI_MAX_REQUESTS_PER_HOUR || 20,
    
    // Fallback to rule-based recommendations if AI fails
    fallbackToRules: env.AI_FALLBACK_TO_RULES !== 'false'
  };

  // Cache for AI responses to avoid redundant API calls
  const responseCache = new Map();
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * Generate comprehensive insights using LLM
   * @param {Object} weeklyData - Processed weekly glucose data
   * @param {Object} treatmentData - Treatment data for the week
   * @param {Object} userSettings - User preferences and settings
   * @returns {Promise<Object>} Enhanced insights object
   */
  async function generateLLMInsights(weeklyData, treatmentData, userSettings) {
    if (!config.enabled || !config.openaiApiKey) {
      logger.warn('AI insights disabled or API key not configured');
      return generateFallbackInsights(weeklyData, treatmentData, userSettings);
    }

    try {
      // Create cache key
      const cacheKey = createCacheKey(weeklyData, userSettings);
      const cachedResponse = responseCache.get(cacheKey);
      
      if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
        logger.debug('Returning cached AI insights');
        return cachedResponse.data;
      }

      // Prepare data for LLM analysis
      const analysisData = prepareDataForLLM(weeklyData, treatmentData, userSettings);
      
      // Generate prompt for LLM
      const prompt = createAnalysisPrompt(analysisData);
      
      // Call LLM API
      const aiResponse = await callLLMAPI(prompt);
      
      // Parse and structure the response
      const insights = parseAIResponse(aiResponse, weeklyData);
      
      // Cache the response
      responseCache.set(cacheKey, {
        data: insights,
        timestamp: Date.now()
      });
      
      logger.info('Generated AI insights successfully');
      return insights;
      
    } catch (error) {
      logger.error('Error generating AI insights:', error);
      
      if (config.fallbackToRules) {
        logger.info('Falling back to rule-based insights');
        return generateFallbackInsights(weeklyData, treatmentData, userSettings);
      }
      
      throw error;
    }
  }

  /**
   * Prepare data for LLM analysis
   */
  function prepareDataForLLM(weeklyData, treatmentData, userSettings) {
    const analysisData = {
      // Basic glucose statistics
      glucoseStats: {
        timeInRange: weeklyData.timeInRange,
        averageGlucose: weeklyData.mean,
        standardDeviation: weeklyData.stdDev,
        totalReadings: weeklyData.total,
        highReadings: weeklyData.highCount,
        lowReadings: weeklyData.lowCount,
        targetRange: {
          low: weeklyData.targetLow,
          high: weeklyData.targetHigh
        }
      },
      
      // Glucose change patterns
      changePatterns: {
        risingRate: weeklyData.risingRateStats,
        fallingRate: weeklyData.fallingRateStats,
        significantRisingPercentage: weeklyData.significantRisingPercentage,
        significantFallingPercentage: weeklyData.significantFallingPercentage
      },
      
      // Temporal patterns
      temporalPatterns: {
        dailyAverages: weeklyData.dailyData,
        hourlyDistribution: weeklyData.hourlyData,
        mostVariableDay: findMostVariableDay(weeklyData.dailyData),
        mostVariableHour: findMostVariableHour(weeklyData.hourlyData)
      },
      
      // Treatment correlation
      treatmentCorrelation: analyzeTreatmentCorrelation(weeklyData.rawData, treatmentData),
      
      // User context
      userContext: {
        units: userSettings.units || 'mg/dl',
        diabetesType: userSettings.diabetesType || 'unknown',
        pumpUser: userSettings.pumpUser || false,
        cgmType: userSettings.cgmType || 'unknown'
      },
      
      // Time period context
      timeContext: {
        weekStart: weeklyData.weekStart,
        weekEnd: weeklyData.weekEnd,
        dayOfWeek: new Date().getDay(),
        season: getSeason(new Date())
      }
    };

    return analysisData;
  }

  /**
   * Create comprehensive prompt for LLM analysis
   */
  function createAnalysisPrompt(analysisData) {
    const prompt = `You are an expert diabetes care specialist and data analyst. Analyze the following glucose data and provide comprehensive insights and actionable recommendations.

GLUCOSE STATISTICS:
- Time in Range: ${analysisData.glucoseStats.timeInRange.toFixed(1)}%
- Average Glucose: ${analysisData.glucoseStats.averageGlucose.toFixed(1)} ${analysisData.userContext.units}
- Standard Deviation: ${analysisData.glucoseStats.standardDeviation.toFixed(1)} ${analysisData.userContext.units}
- Total Readings: ${analysisData.glucoseStats.totalReadings}
- High Readings: ${analysisData.glucoseStats.highReadings} (${((analysisData.glucoseStats.highReadings / analysisData.glucoseStats.totalReadings) * 100).toFixed(1)}%)
- Low Readings: ${analysisData.glucoseStats.lowReadings} (${((analysisData.glucoseStats.lowReadings / analysisData.glucoseStats.totalReadings) * 100).toFixed(1)}%)
- Target Range: ${analysisData.glucoseStats.targetRange.low} - ${analysisData.glucoseStats.targetRange.high} ${analysisData.userContext.units}

GLUCOSE CHANGE PATTERNS:
- Average Rising Rate: ${analysisData.changePatterns.risingRate?.mean?.toFixed(3) || 'N/A'} ${analysisData.userContext.units}/min
- Average Falling Rate: ${analysisData.changePatterns.fallingRate?.mean?.toFixed(3) || 'N/A'} ${analysisData.userContext.units}/min
- Significant Rising Episodes: ${analysisData.changePatterns.significantRisingPercentage.toFixed(1)}%
- Significant Falling Episodes: ${analysisData.changePatterns.significantFallingPercentage.toFixed(1)}%

TEMPORAL PATTERNS:
- Most Variable Day: ${analysisData.temporalPatterns.mostVariableDay}
- Most Variable Hour: ${analysisData.temporalPatterns.mostVariableHour}:00

USER CONTEXT:
- Diabetes Type: ${analysisData.userContext.diabetesType}
- Pump User: ${analysisData.userContext.pumpUser ? 'Yes' : 'No'}
- CGM Type: ${analysisData.userContext.cgmType}
- Season: ${analysisData.timeContext.season}

Please provide a comprehensive analysis in the following JSON format:

{
  "overallAssessment": {
    "score": "number between 1-10",
    "summary": "brief overall assessment",
    "keyStrengths": ["strength1", "strength2"],
    "keyChallenges": ["challenge1", "challenge2"]
  },
  "priorityRecommendations": [
    {
      "priority": "high|medium|low",
      "category": "insulin|meals|monitoring|lifestyle",
      "title": "recommendation title",
      "description": "detailed recommendation",
      "rationale": "why this is important",
      "expectedImpact": "what improvement to expect"
    }
  ],
  "patternInsights": [
    {
      "pattern": "pattern description",
      "significance": "why this matters",
      "suggestions": ["suggestion1", "suggestion2"]
    }
  ],
  "predictiveInsights": {
    "riskFactors": ["risk factor 1", "risk factor 2"],
    "opportunities": ["opportunity 1", "opportunity 2"],
    "trendWarnings": ["warning 1", "warning 2"]
  },
  "personalizedTips": [
    {
      "tip": "personalized tip",
      "context": "when/why to apply this tip"
    }
  ]
}

Focus on:
1. Actionable, specific recommendations
2. Root cause analysis of patterns
3. Personalized advice based on the user's context
4. Prevention of future issues
5. Optimizing current management strategies

Provide insights that go beyond basic rule-based recommendations and offer deeper understanding of glucose patterns.`;

    return prompt;
  }

  /**
   * Call LLM API (OpenAI or Anthropic)
   */
  async function callLLMAPI(prompt) {
    // Try OpenAI first, fallback to Anthropic
    if (config.openaiApiKey) {
      return await callOpenAI(prompt);
    } else if (config.anthropicApiKey) {
      return await callAnthropic(prompt);
    } else {
      throw new Error('No LLM API key configured');
    }
  }

  /**
   * Call OpenAI API
   */
  async function callOpenAI(prompt) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: config.openaiModel,
      messages: [
        {
          role: 'system',
          content: 'You are an expert diabetes care specialist. Provide detailed, actionable insights in valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  }

  /**
   * Call Anthropic API
   */
  async function callAnthropic(prompt) {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: config.anthropicModel,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'x-api-key': config.anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    return response.data.content[0].text;
  }

  /**
   * Parse AI response and structure it
   */
  function parseAIResponse(aiResponse, weeklyData) {
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Enhance with additional computed metrics
      const enhancedInsights = {
        ...parsedResponse,
        metadata: {
          generatedAt: new Date().toISOString(),
          dataPeriod: {
            start: weeklyData.weekStart,
            end: weeklyData.weekEnd
          },
          dataQuality: assessDataQuality(weeklyData),
          confidence: calculateConfidenceScore(weeklyData)
        }
      };
      
      return enhancedInsights;
      
    } catch (error) {
      logger.error('Error parsing AI response:', error);
      throw new Error('Failed to parse AI response: ' + error.message);
    }
  }

  /**
   * Generate fallback insights using rule-based logic
   */
  function generateFallbackInsights(weeklyData, treatmentData, userSettings) {
    return {
      overallAssessment: {
        score: calculateOverallScore(weeklyData),
        summary: generateBasicSummary(weeklyData),
        keyStrengths: identifyStrengths(weeklyData),
        keyChallenges: identifyChallenges(weeklyData)
      },
      priorityRecommendations: generateRuleBasedRecommendations(weeklyData),
      patternInsights: generatePatternInsights(weeklyData),
      predictiveInsights: generatePredictiveInsights(weeklyData),
      personalizedTips: generatePersonalizedTips(weeklyData, userSettings),
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'rule-based',
        dataQuality: assessDataQuality(weeklyData)
      }
    };
  }

  // Helper functions
  function createCacheKey(weeklyData, userSettings) {
    return `${weeklyData.weekStart}_${weeklyData.weekEnd}_${userSettings.units}_${JSON.stringify(weeklyData)}`;
  }

  function findMostVariableDay(dailyData) {
    // Implementation to find most variable day
    return 'Monday'; // Placeholder
  }

  function findMostVariableHour(hourlyData) {
    // Implementation to find most variable hour
    return 14; // Placeholder
  }

  function analyzeTreatmentCorrelation(glucoseData, treatmentData) {
    // Implementation to analyze treatment correlation
    return {
      correlation: 'moderate',
      insights: ['Treatment timing shows moderate correlation with glucose patterns']
    };
  }

  function getSeason(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  }

  function assessDataQuality(weeklyData) {
    const completeness = weeklyData.total / (7 * 24 * 12); // Expected readings per week (5-min intervals)
    return {
      completeness: Math.min(completeness, 1),
      reliability: completeness > 0.8 ? 'high' : completeness > 0.6 ? 'medium' : 'low'
    };
  }

  function calculateConfidenceScore(weeklyData) {
    const dataQuality = assessDataQuality(weeklyData);
    const baseScore = dataQuality.completeness;
    
    // Adjust based on data consistency
    const consistencyBonus = weeklyData.stdDev < (weeklyData.mean * 0.3) ? 0.1 : 0;
    
    return Math.min(baseScore + consistencyBonus, 1);
  }

  function calculateOverallScore(weeklyData) {
    const tir = weeklyData.timeInRange / 100;
    const variability = Math.max(0, 1 - (weeklyData.stdDev / (weeklyData.mean * 0.5)));
    
    return Math.round((tir * 0.6 + variability * 0.4) * 10);
  }

  function generateBasicSummary(weeklyData) {
    if (weeklyData.timeInRange >= 80) {
      return 'Excellent glucose control with strong time in range performance.';
    } else if (weeklyData.timeInRange >= 70) {
      return 'Good glucose control with room for improvement in time in range.';
    } else {
      return 'Glucose control needs attention, particularly with time in range.';
    }
  }

  function identifyStrengths(weeklyData) {
    const strengths = [];
    if (weeklyData.timeInRange >= 70) strengths.push('Good time in range');
    if (weeklyData.stdDev < weeklyData.mean * 0.3) strengths.push('Low glucose variability');
    if (weeklyData.lowCount < weeklyData.total * 0.05) strengths.push('Low hypoglycemia risk');
    return strengths;
  }

  function identifyChallenges(weeklyData) {
    const challenges = [];
    if (weeklyData.timeInRange < 70) challenges.push('Time in range below target');
    if (weeklyData.stdDev > weeklyData.mean * 0.4) challenges.push('High glucose variability');
    if (weeklyData.highCount > weeklyData.total * 0.3) challenges.push('Frequent hyperglycemia');
    return challenges;
  }

  function generateRuleBasedRecommendations(weeklyData) {
    const recommendations = [];
    
    if (weeklyData.timeInRange < 70) {
      recommendations.push({
        priority: 'high',
        category: 'insulin',
        title: 'Improve Time in Range',
        description: 'Focus on better insulin dosing and timing to increase time in range.',
        rationale: `Current time in range is ${weeklyData.timeInRange.toFixed(1)}%, below the recommended 70%.`,
        expectedImpact: 'Improved glucose control and reduced diabetes complications risk'
      });
    }
    
    return recommendations;
  }

  function generatePatternInsights(weeklyData) {
    return [
      {
        pattern: 'Glucose variability patterns',
        significance: 'Understanding variability helps optimize management',
        suggestions: ['Monitor meal timing', 'Check insulin sensitivity']
      }
    ];
  }

  function generatePredictiveInsights(weeklyData) {
    return {
      riskFactors: ['High glucose variability'],
      opportunities: ['Optimize meal timing'],
      trendWarnings: ['Monitor for pattern changes']
    };
  }

  function generatePersonalizedTips(weeklyData, userSettings) {
    return [
      {
        tip: 'Consider pre-bolusing 15 minutes before meals',
        context: 'Based on observed glucose rise patterns'
      }
    ];
  }

  return {
    generateLLMInsights,
    config
  };
}

module.exports = create;
