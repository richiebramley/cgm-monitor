'use strict';

/**
 * Enhanced Weekly Summary API with LLM Integration
 * Provides comprehensive weekly analysis with AI-powered insights
 */

function create(app, wares, ctx, env) {
  const express = require('express');
  const router = express.Router();
  const logger = require('../../../lib/logger')('weekly-summary-api');
  
  // Initialize AI insights module
  const aiInsights = require('../../ai-insights/llm-insights')(env, ctx);

  /**
   * GET /api/v1/weekly-summary
   * Get comprehensive weekly summary with AI insights
   */
  router.get('/', wares.verifyAuthorization, async function(req, res, next) {
    try {
      const {
        weekStart, // ISO date string for week start (Monday)
        includeTreatments = 'true',
        includeAIInsights = 'true'
      } = req.query;

      // Parse and validate week start date
      const startDate = weekStart ? new Date(weekStart) : getCurrentWeekStart();
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({
          error: 'Invalid weekStart date format. Use ISO date string.'
        });
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      logger.info(`Generating weekly summary for ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get user settings
      const userSettings = await getUserSettings(ctx, req);
      
      // Load glucose data
      const glucoseData = await loadGlucoseData(ctx, startDate, endDate);
      
      // Load treatment data if requested
      let treatmentData = null;
      if (includeTreatments === 'true') {
        treatmentData = await loadTreatmentData(ctx, startDate, endDate);
      }

      // Process weekly data
      const weeklyData = await processWeeklyData(glucoseData, userSettings, startDate, endDate);
      
      // Generate AI insights if requested
      let aiInsightsData = null;
      if (includeAIInsights === 'true') {
        try {
          aiInsightsData = await aiInsights.generateLLMInsights(weeklyData, treatmentData, userSettings);
        } catch (error) {
          logger.warn('Failed to generate AI insights, continuing without them:', error.message);
        }
      }

      // Compile comprehensive response
      const response = {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          weekNumber: getWeekNumber(startDate)
        },
        statistics: weeklyData.statistics,
        recommendations: weeklyData.recommendations,
        patterns: weeklyData.patterns,
        charts: weeklyData.charts,
        facts: weeklyData.facts,
        aiInsights: aiInsightsData,
        metadata: {
          generatedAt: new Date().toISOString(),
          dataCompleteness: weeklyData.dataCompleteness,
          processingTime: Date.now() - req.startTime
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Error generating weekly summary:', error);
      res.status(500).json({
        error: 'Failed to generate weekly summary',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/weekly-summary/compare
   * Compare current week with previous weeks
   */
  router.get('/compare', wares.verifyAuthorization, async function(req, res, next) {
    try {
      const {
        weeks = '4', // Number of weeks to compare
        includeAIInsights = 'true'
      } = req.query;

      const numWeeks = parseInt(weeks);
      if (numWeeks < 2 || numWeeks > 12) {
        return res.status(400).json({
          error: 'Number of weeks must be between 2 and 12'
        });
      }

      const currentWeekStart = getCurrentWeekStart();
      const comparisons = [];

      // Generate summary for each week
      for (let i = 0; i < numWeeks; i++) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        try {
          const userSettings = await getUserSettings(ctx, req);
          const glucoseData = await loadGlucoseData(ctx, weekStart, weekEnd);
          const weeklyData = await processWeeklyData(glucoseData, userSettings, weekStart, weekEnd);
          
          let aiInsights = null;
          if (includeAIInsights === 'true') {
            try {
              aiInsights = await aiInsights.generateLLMInsights(weeklyData, null, userSettings);
            } catch (error) {
              logger.warn(`Failed to generate AI insights for week ${i}:`, error.message);
            }
          }

          comparisons.push({
            weekNumber: i + 1,
            period: {
              start: weekStart.toISOString(),
              end: weekEnd.toISOString()
            },
            statistics: weeklyData.statistics,
            aiInsights: aiInsights ? {
              overallAssessment: aiInsights.overallAssessment,
              priorityRecommendations: aiInsights.priorityRecommendations?.slice(0, 3) // Top 3 recommendations
            } : null
          });
        } catch (error) {
          logger.error(`Error processing week ${i}:`, error);
          comparisons.push({
            weekNumber: i + 1,
            period: {
              start: weekStart.toISOString(),
              end: weekEnd.toISOString()
            },
            error: 'Failed to process week data'
          });
        }
      }

      // Generate trend analysis
      const trendAnalysis = analyzeTrends(comparisons);

      res.json({
        comparisons,
        trendAnalysis,
        metadata: {
          generatedAt: new Date().toISOString(),
          totalWeeks: numWeeks
        }
      });

    } catch (error) {
      logger.error('Error generating weekly comparison:', error);
      res.status(500).json({
        error: 'Failed to generate weekly comparison',
        message: error.message
      });
    }
  });

  /**
   * POST /api/v1/weekly-summary/insights
   * Generate custom insights for a specific period
   */
  router.post('/insights', wares.verifyAuthorization, async function(req, res, next) {
    try {
      const {
        startDate,
        endDate,
        focusAreas = ['glucose', 'treatments', 'patterns'],
        includePredictions = false
      } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'startDate and endDate are required'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format. Use ISO date strings.'
        });
      }

      // Limit analysis period to 30 days
      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDiff > 30) {
        return res.status(400).json({
          error: 'Analysis period cannot exceed 30 days'
        });
      }

      const userSettings = await getUserSettings(ctx, req);
      const glucoseData = await loadGlucoseData(ctx, start, end);
      const treatmentData = await loadTreatmentData(ctx, start, end);
      const weeklyData = await processWeeklyData(glucoseData, userSettings, start, end);

      // Generate focused AI insights
      const aiInsightsData = await aiInsights.generateLLMInsights(weeklyData, treatmentData, userSettings);

      // Filter insights based on focus areas
      const filteredInsights = filterInsightsByFocus(aiInsightsData, focusAreas);

      res.json({
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          duration: Math.round(daysDiff)
        },
        insights: filteredInsights,
        metadata: {
          generatedAt: new Date().toISOString(),
          focusAreas,
          includePredictions
        }
      });

    } catch (error) {
      logger.error('Error generating custom insights:', error);
      res.status(500).json({
        error: 'Failed to generate custom insights',
        message: error.message
      });
    }
  });

  // Helper functions
  function getCurrentWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function getWeekNumber(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - startOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  }

  async function getUserSettings(ctx, req) {
    // Get user settings from various sources
    const settings = {
      units: 'mg/dl', // Default
      thresholds: {
        bgLow: 70,
        bgHigh: 180
      }
    };

    // Try to get from profile or client settings
    try {
      // This would integrate with existing settings system
      // For now, return default settings
    } catch (error) {
      logger.warn('Could not load user settings, using defaults:', error.message);
    }

    return settings;
  }

  async function loadGlucoseData(ctx, startDate, endDate) {
    try {
      const query = {
        find: {
          dateString: {
            $gte: startDate.toISOString().split('T')[0],
            $lte: endDate.toISOString().split('T')[0]
          },
          type: 'sgv'
        },
        count: 10000
      };

      const results = await ctx.entries.list(query);
      return results || [];
    } catch (error) {
      logger.error('Error loading glucose data:', error);
      throw new Error('Failed to load glucose data');
    }
  }

  async function loadTreatmentData(ctx, startDate, endDate) {
    try {
      const query = {
        find: {
          dateString: {
            $gte: startDate.toISOString().split('T')[0],
            $lte: endDate.toISOString().split('T')[0]
          }
        },
        count: 1000
      };

      const results = await ctx.treatments.list(query);
      return results || [];
    } catch (error) {
      logger.error('Error loading treatment data:', error);
      return []; // Return empty array instead of throwing error
    }
  }

  async function processWeeklyData(glucoseData, userSettings, startDate, endDate) {
    // Filter and process glucose data
    const sgvData = glucoseData.filter(entry => entry.type === 'sgv' && entry.sgv)
      .map(entry => ({
        sgv: parseFloat(entry.sgv),
        date: new Date(entry.dateString),
        mills: entry.mills || new Date(entry.dateString).getTime()
      }))
      .filter(entry => !isNaN(entry.sgv) && entry.sgv > 0);

    if (sgvData.length === 0) {
      throw new Error('No glucose data available for the selected period');
    }

    // Calculate comprehensive statistics
    const statistics = calculateEnhancedStatistics(sgvData, userSettings);
    
    // Generate recommendations
    const recommendations = generateEnhancedRecommendations(statistics, userSettings);
    
    // Identify patterns
    const patterns = identifyPatterns(sgvData, userSettings);
    
    // Create chart data
    const charts = createChartData(sgvData, userSettings);
    
    // Generate interesting facts
    const facts = generateFacts(sgvData, statistics, userSettings);

    // Calculate data completeness
    const expectedReadings = (endDate - startDate) / (1000 * 60 * 5); // 5-minute intervals
    const dataCompleteness = Math.min(sgvData.length / expectedReadings, 1);

    return {
      weekStart: startDate,
      weekEnd: endDate,
      statistics,
      recommendations,
      patterns,
      charts,
      facts,
      dataCompleteness,
      rawData: sgvData
    };
  }

  function calculateEnhancedStatistics(data, userSettings) {
    const values = data.map(d => d.sgv);
    const total = values.length;
    
    // Basic statistics
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / total;
    
    // Standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / total;
    const stdDev = Math.sqrt(variance);
    
    // Range analysis
    const targetLow = userSettings.thresholds.bgLow;
    const targetHigh = userSettings.thresholds.bgHigh;
    
    const lowValues = values.filter(v => v < targetLow);
    const highValues = values.filter(v => v >= targetHigh);
    const inRangeValues = values.filter(v => v >= targetLow && v < targetHigh);
    
    const timeInRange = (inRangeValues.length / total) * 100;
    
    // Glucose change rates
    const changeRates = calculateChangeRates(data);
    
    // Temporal patterns
    const hourlyData = groupByHour(data);
    const dailyData = groupByDay(data);

    return {
      total,
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      timeInRange,
      lowCount: lowValues.length,
      highCount: highValues.length,
      inRangeCount: inRangeValues.length,
      targetLow,
      targetHigh,
      changeRates,
      hourlyData,
      dailyData
    };
  }

  function calculateChangeRates(data) {
    const sortedData = data.slice().sort((a, b) => a.mills - b.mills);
    const changeRates = [];
    
    for (let i = 1; i < sortedData.length; i++) {
      const timeDiff = (sortedData[i].mills - sortedData[i-1].mills) / (1000 * 60);
      if (timeDiff >= 3 && timeDiff <= 15) {
        const glucoseChange = sortedData[i].sgv - sortedData[i-1].sgv;
        const ratePerMinute = glucoseChange / timeDiff;
        changeRates.push(ratePerMinute);
      }
    }
    
    const risingRates = changeRates.filter(rate => rate > 0);
    const fallingRates = changeRates.filter(rate => rate < 0).map(rate => Math.abs(rate));
    
    return {
      rising: {
        count: risingRates.length,
        mean: risingRates.length > 0 ? risingRates.reduce((a, b) => a + b, 0) / risingRates.length : 0,
        max: risingRates.length > 0 ? Math.max(...risingRates) : 0
      },
      falling: {
        count: fallingRates.length,
        mean: fallingRates.length > 0 ? fallingRates.reduce((a, b) => a + b, 0) / fallingRates.length : 0,
        max: fallingRates.length > 0 ? Math.max(...fallingRates) : 0
      }
    };
  }

  function groupByHour(data) {
    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = [];
    }
    
    data.forEach(entry => {
      const hour = entry.date.getHours();
      hourlyData[hour].push(entry.sgv);
    });
    
    return hourlyData;
  }

  function groupByDay(data) {
    const dailyData = {};
    for (let i = 0; i < 7; i++) {
      dailyData[i] = [];
    }
    
    data.forEach(entry => {
      const day = entry.date.getDay();
      dailyData[day].push(entry.sgv);
    });
    
    return dailyData;
  }

  function generateEnhancedRecommendations(statistics, userSettings) {
    const recommendations = [];
    
    // Time in range recommendations
    if (statistics.timeInRange < 70) {
      recommendations.push({
        priority: 'high',
        category: 'glucose_control',
        title: 'Improve Time in Range',
        description: `Current time in range is ${statistics.timeInRange.toFixed(1)}%, below the recommended 70%.`,
        action: 'Review insulin dosing and meal timing strategies.'
      });
    }
    
    // Variability recommendations
    if (statistics.stdDev > statistics.mean * 0.4) {
      recommendations.push({
        priority: 'medium',
        category: 'variability',
        title: 'Reduce Glucose Variability',
        description: `High glucose variability (${statistics.stdDev.toFixed(1)}) may indicate inconsistent management.`,
        action: 'Consider more consistent meal timing and insulin dosing.'
      });
    }
    
    return recommendations;
  }

  function identifyPatterns(data, userSettings) {
    const patterns = [];
    
    // Identify temporal patterns
    const hourlyAverages = {};
    for (let hour = 0; hour < 24; hour++) {
      const hourData = data.filter(d => d.date.getHours() === hour);
      if (hourData.length > 0) {
        hourlyAverages[hour] = hourData.reduce((sum, d) => sum + d.sgv, 0) / hourData.length;
      }
    }
    
    // Find peak hours
    const peakHours = Object.entries(hourlyAverages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, avg]) => ({ hour: parseInt(hour), average: avg }));
    
    patterns.push({
      type: 'temporal',
      name: 'Peak Glucose Hours',
      description: 'Hours with highest average glucose',
      data: peakHours
    });
    
    return patterns;
  }

  function createChartData(data, userSettings) {
    return {
      hourlyDistribution: groupByHour(data),
      dailyTrends: groupByDay(data),
      timeSeries: data.map(d => ({
        timestamp: d.mills,
        value: d.sgv
      }))
    };
  }

  function generateFacts(data, statistics, userSettings) {
    const facts = [];
    
    // Find longest streak in range
    const longestStreak = findLongestStreak(data, userSettings.thresholds, true);
    if (longestStreak.count > 0) {
      facts.push({
        title: 'Longest Time in Range',
        description: `${longestStreak.count} consecutive readings (${Math.round(longestStreak.count * 5 / 60)} hours)`
      });
    }
    
    return facts;
  }

  function findLongestStreak(data, thresholds, inRange) {
    const sortedData = data.slice().sort((a, b) => a.mills - b.mills);
    let currentStreak = 0;
    let maxStreak = 0;
    
    sortedData.forEach(entry => {
      const isInRange = entry.sgv >= thresholds.bgLow && entry.sgv < thresholds.bgHigh;
      if (isInRange === inRange) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });
    
    return { count: maxStreak };
  }

  function analyzeTrends(comparisons) {
    const validComparisons = comparisons.filter(c => !c.error);
    if (validComparisons.length < 2) {
      return { error: 'Insufficient data for trend analysis' };
    }
    
    const tirTrend = validComparisons.map(c => c.statistics.timeInRange);
    const avgGlucoseTrend = validComparisons.map(c => c.statistics.mean);
    
    return {
      timeInRange: {
        current: tirTrend[0],
        previous: tirTrend[1],
        trend: tirTrend[0] > tirTrend[1] ? 'improving' : tirTrend[0] < tirTrend[1] ? 'declining' : 'stable'
      },
      averageGlucose: {
        current: avgGlucoseTrend[0],
        previous: avgGlucoseTrend[1],
        trend: avgGlucoseTrend[0] < avgGlucoseTrend[1] ? 'improving' : avgGlucoseTrend[0] > avgGlucoseTrend[1] ? 'declining' : 'stable'
      }
    };
  }

  function filterInsightsByFocus(insights, focusAreas) {
    const filtered = {};
    
    if (focusAreas.includes('glucose')) {
      filtered.overallAssessment = insights.overallAssessment;
      filtered.patternInsights = insights.patternInsights;
    }
    
    if (focusAreas.includes('treatments')) {
      filtered.priorityRecommendations = insights.priorityRecommendations?.filter(rec => 
        rec.category === 'insulin' || rec.category === 'meals'
      );
    }
    
    if (focusAreas.includes('patterns')) {
      filtered.patternInsights = insights.patternInsights;
      filtered.predictiveInsights = insights.predictiveInsights;
    }
    
    return filtered;
  }

  return router;
}

module.exports = create;
