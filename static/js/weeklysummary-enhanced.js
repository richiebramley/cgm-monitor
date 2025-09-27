'use strict';

/**
 * Enhanced Weekly Summary with LLM Integration
 * Provides advanced insights and AI-powered recommendations
 */

var weeklySummaryEnhanced = {
  currentWeekStart: null,
  client: null,
  settings: null,
  aiInsightsEnabled: true,
  apiBaseUrl: '/api/v1/weekly-summary'
};

function init() {
  console.log('Initializing Enhanced Weekly Summary');
  
  // Initialize with current week (Monday to Sunday)
  var now = new Date();
  var dayOfWeek = now.getDay();
  var daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weeklySummaryEnhanced.currentWeekStart = new Date(now);
  weeklySummaryEnhanced.currentWeekStart.setDate(now.getDate() - daysToMonday);
  weeklySummaryEnhanced.currentWeekStart.setHours(0, 0, 0, 0);
  
  // Initialize client and settings
  if (window.Nightscout && window.Nightscout.client) {
    weeklySummaryEnhanced.client = window.Nightscout.client;
    weeklySummaryEnhanced.settings = weeklySummaryEnhanced.client.settings;
    setupEventListeners();
    loadEnhancedWeeklyData();
  } else {
    // Wait for client to be available
    var checkClient = setInterval(function() {
      if (window.Nightscout && window.Nightscout.client) {
        weeklySummaryEnhanced.client = window.Nightscout.client;
        weeklySummaryEnhanced.settings = weeklySummaryEnhanced.client.settings;
        clearInterval(checkClient);
        setupEventListeners();
        loadEnhancedWeeklyData();
      }
    }, 100);
  }
}

function setupEventListeners() {
  $('#prevWeek').click(function() {
    weeklySummaryEnhanced.currentWeekStart.setDate(weeklySummaryEnhanced.currentWeekStart.getDate() - 7);
    loadEnhancedWeeklyData();
    updateWeekSelector();
  });
  
  $('#currentWeek').click(function() {
    var now = new Date();
    var dayOfWeek = now.getDay();
    var daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weeklySummaryEnhanced.currentWeekStart = new Date(now);
    weeklySummaryEnhanced.currentWeekStart.setDate(now.getDate() - daysToMonday);
    weeklySummaryEnhanced.currentWeekStart.setHours(0, 0, 0, 0);
    loadEnhancedWeeklyData();
    updateWeekSelector();
  });
  
  $('#nextWeek').click(function() {
    weeklySummaryEnhanced.currentWeekStart.setDate(weeklySummaryEnhanced.currentWeekStart.getDate() + 7);
    loadEnhancedWeeklyData();
    updateWeekSelector();
  });

  // Toggle AI insights
  $('#toggleAIInsights').click(function() {
    weeklySummaryEnhanced.aiInsightsEnabled = !weeklySummaryEnhanced.aiInsightsEnabled;
    $(this).text(weeklySummaryEnhanced.aiInsightsEnabled ? 'Disable AI Insights' : 'Enable AI Insights');
    loadEnhancedWeeklyData();
  });

  // Load comparison view
  $('#loadComparison').click(function() {
    loadWeeklyComparison();
  });
}

function updateWeekSelector() {
  $('.week-selector button').removeClass('active');
  
  var now = new Date();
  var currentWeekStart = new Date(now);
  var dayOfWeek = now.getDay();
  var daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentWeekStart.setDate(now.getDate() - daysToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  if (weeklySummaryEnhanced.currentWeekStart.getTime() === currentWeekStart.getTime()) {
    $('#currentWeek').addClass('active');
  } else if (weeklySummaryEnhanced.currentWeekStart.getTime() < currentWeekStart.getTime()) {
    $('#prevWeek').addClass('active');
  } else {
    $('#nextWeek').addClass('active');
  }
}

async function loadEnhancedWeeklyData() {
  showLoading();
  
  var weekEnd = new Date(weeklySummaryEnhanced.currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  updateDateRange(weeklySummaryEnhanced.currentWeekStart, weekEnd);
  
  try {
    const queryParams = new URLSearchParams({
      weekStart: weeklySummaryEnhanced.currentWeekStart.toISOString(),
      includeTreatments: 'true',
      includeAIInsights: weeklySummaryEnhanced.aiInsightsEnabled.toString()
    });

    const response = await fetch(`${weeklySummaryEnhanced.apiBaseUrl}?${queryParams}`, {
      headers: weeklySummaryEnhanced.client ? weeklySummaryEnhanced.client.headers() : {}
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    processEnhancedWeeklyData(data);
    
  } catch (error) {
    console.error('Error loading enhanced weekly data:', error);
    showError('Failed to load weekly data: ' + error.message);
  }
}

function processEnhancedWeeklyData(data) {
  try {
    // Update basic statistics
    updateEnhancedStatistics(data.statistics);
    
    // Update recommendations
    updateEnhancedRecommendations(data.recommendations, data.aiInsights);
    
    // Update AI insights if available
    if (data.aiInsights) {
      updateAIInsights(data.aiInsights);
    }
    
    // Update patterns
    updatePatternInsights(data.patterns);
    
    // Update facts
    updateEnhancedFacts(data.facts);
    
    // Create enhanced charts
    createEnhancedCharts(data.charts, data.statistics);
    
    // Update metadata
    updateMetadata(data.metadata);
    
    showContent();
    
  } catch (error) {
    console.error('Error processing enhanced weekly data:', error);
    showError('Error processing data: ' + error.message);
  }
}

function updateEnhancedStatistics(statistics) {
  var units = getUserUnits();
  
  // Basic statistics
  $('#timeInRange').text(Math.round(statistics.timeInRange) + '%');
  $('#avgGlucose').text(formatGlucose(statistics.mean, units));
  $('#stdDev').text(formatGlucose(statistics.stdDev, units));
  $('#totalReadings').text(statistics.total);
  $('#highReadings').text(statistics.highCount + ' (' + Math.round((statistics.highCount / statistics.total) * 100) + '%)');
  $('#lowReadings').text(statistics.lowCount + ' (' + Math.round((statistics.lowCount / statistics.total) * 100) + '%)');
  
  // Enhanced statistics
  $('#glucoseRange').text(formatGlucose(statistics.min, units) + ' - ' + formatGlucose(statistics.max, units));
  $('#variabilityScore').text(calculateVariabilityScore(statistics));
  $('#dataCompleteness').text(Math.round(statistics.dataCompleteness * 100) + '%');
  
  // Change rates
  if (statistics.changeRates) {
    var risingRate = statistics.changeRates.rising.mean || 0;
    var fallingRate = statistics.changeRates.falling.mean || 0;
    $('#risingRate').text(formatChangeRate(risingRate, units));
    $('#fallingRate').text(formatChangeRate(fallingRate, units));
  }
}

function updateEnhancedRecommendations(basicRecommendations, aiInsights) {
  var container = $('#recommendationsList');
  container.empty();
  
  // Add AI insights recommendations if available
  if (aiInsights && aiInsights.priorityRecommendations) {
    aiInsights.priorityRecommendations.forEach(function(rec) {
      var item = $('<div class="recommendation-item ai-recommendation ' + rec.priority + '"></div>');
      item.append('<div class="recommendation-header">');
      item.find('.recommendation-header').append('<span class="recommendation-priority">' + rec.priority.toUpperCase() + '</span>');
      item.find('.recommendation-header').append('<span class="recommendation-category">' + rec.category + '</span>');
      item.append('</div>');
      item.append('<div class="recommendation-title">' + rec.title + '</div>');
      item.append('<div class="recommendation-description">' + rec.description + '</div>');
      if (rec.rationale) {
        item.append('<div class="recommendation-rationale"><strong>Why:</strong> ' + rec.rationale + '</div>');
      }
      if (rec.expectedImpact) {
        item.append('<div class="recommendation-impact"><strong>Expected Impact:</strong> ' + rec.expectedImpact + '</div>');
      }
      container.append(item);
    });
  }
  
  // Add basic recommendations
  basicRecommendations.forEach(function(rec) {
    var item = $('<div class="recommendation-item basic-recommendation ' + rec.priority + '"></div>');
    item.append('<div class="recommendation-title">' + rec.title + '</div>');
    item.append('<div class="recommendation-description">' + rec.description + '</div>');
    if (rec.action) {
      item.append('<div class="recommendation-action"><strong>Action:</strong> ' + rec.action + '</div>');
    }
    container.append(item);
  });
  
  if (container.children().length === 0) {
    container.append('<p style="color: #666; font-style: italic;">No specific recommendations at this time. Keep monitoring your glucose levels.</p>');
  }
}

function updateAIInsights(aiInsights) {
  // Update overall assessment
  if (aiInsights.overallAssessment) {
    updateOverallAssessment(aiInsights.overallAssessment);
  }
  
  // Update pattern insights
  if (aiInsights.patternInsights) {
    updateAIPatternInsights(aiInsights.patternInsights);
  }
  
  // Update predictive insights
  if (aiInsights.predictiveInsights) {
    updatePredictiveInsights(aiInsights.predictiveInsights);
  }
  
  // Update personalized tips
  if (aiInsights.personalizedTips) {
    updatePersonalizedTips(aiInsights.personalizedTips);
  }
}

function updateOverallAssessment(assessment) {
  var container = $('#overallAssessment');
  container.empty();
  
  // Score indicator
  var scoreContainer = $('<div class="assessment-score"></div>');
  scoreContainer.append('<div class="score-circle" data-score="' + assessment.score + '">' + assessment.score + '/10</div>');
  scoreContainer.append('<div class="score-label">Overall Score</div>');
  container.append(scoreContainer);
  
  // Summary
  container.append('<div class="assessment-summary">' + assessment.summary + '</div>');
  
  // Strengths and challenges
  if (assessment.keyStrengths && assessment.keyStrengths.length > 0) {
    var strengthsDiv = $('<div class="assessment-section strengths"></div>');
    strengthsDiv.append('<h4>Key Strengths</h4>');
    var strengthsList = $('<ul></ul>');
    assessment.keyStrengths.forEach(function(strength) {
      strengthsList.append('<li>' + strength + '</li>');
    });
    strengthsDiv.append(strengthsList);
    container.append(strengthsDiv);
  }
  
  if (assessment.keyChallenges && assessment.keyChallenges.length > 0) {
    var challengesDiv = $('<div class="assessment-section challenges"></div>');
    challengesDiv.append('<h4>Key Challenges</h4>');
    var challengesList = $('<ul></ul>');
    assessment.keyChallenges.forEach(function(challenge) {
      challengesList.append('<li>' + challenge + '</li>');
    });
    challengesDiv.append(challengesList);
    container.append(challengesDiv);
  }
}

function updateAIPatternInsights(patternInsights) {
  var container = $('#patternInsights');
  container.empty();
  
  patternInsights.forEach(function(insight) {
    var item = $('<div class="pattern-insight"></div>');
    item.append('<div class="pattern-title">' + insight.pattern + '</div>');
    item.append('<div class="pattern-significance">' + insight.significance + '</div>');
    if (insight.suggestions && insight.suggestions.length > 0) {
      var suggestionsList = $('<ul class="pattern-suggestions"></ul>');
      insight.suggestions.forEach(function(suggestion) {
        suggestionsList.append('<li>' + suggestion + '</li>');
      });
      item.append(suggestionsList);
    }
    container.append(item);
  });
}

function updatePredictiveInsights(predictiveInsights) {
  var container = $('#predictiveInsights');
  container.empty();
  
  // Risk factors
  if (predictiveInsights.riskFactors && predictiveInsights.riskFactors.length > 0) {
    var risksDiv = $('<div class="predictive-section risks"></div>');
    risksDiv.append('<h4>Risk Factors</h4>');
    var risksList = $('<ul></ul>');
    predictiveInsights.riskFactors.forEach(function(risk) {
      risksList.append('<li class="risk-factor">' + risk + '</li>');
    });
    risksDiv.append(risksList);
    container.append(risksDiv);
  }
  
  // Opportunities
  if (predictiveInsights.opportunities && predictiveInsights.opportunities.length > 0) {
    var opportunitiesDiv = $('<div class="predictive-section opportunities"></div>');
    opportunitiesDiv.append('<h4>Opportunities</h4>');
    var opportunitiesList = $('<ul></ul>');
    predictiveInsights.opportunities.forEach(function(opportunity) {
      opportunitiesList.append('<li class="opportunity">' + opportunity + '</li>');
    });
    opportunitiesDiv.append(opportunitiesList);
    container.append(opportunitiesDiv);
  }
  
  // Trend warnings
  if (predictiveInsights.trendWarnings && predictiveInsights.trendWarnings.length > 0) {
    var warningsDiv = $('<div class="predictive-section warnings"></div>');
    warningsDiv.append('<h4>Trend Warnings</h4>');
    var warningsList = $('<ul></ul>');
    predictiveInsights.trendWarnings.forEach(function(warning) {
      warningsList.append('<li class="trend-warning">' + warning + '</li>');
    });
    warningsDiv.append(warningsList);
    container.append(warningsDiv);
  }
}

function updatePersonalizedTips(personalizedTips) {
  var container = $('#personalizedTips');
  container.empty();
  
  personalizedTips.forEach(function(tip) {
    var item = $('<div class="personalized-tip"></div>');
    item.append('<div class="tip-content">' + tip.tip + '</div>');
    if (tip.context) {
      item.append('<div class="tip-context">' + tip.context + '</div>');
    }
    container.append(item);
  });
}

function updatePatternInsights(patterns) {
  var container = $('#patternInsights');
  
  // Add basic pattern insights if AI insights are not available
  if (container.children().length === 0) {
    patterns.forEach(function(pattern) {
      var item = $('<div class="pattern-insight basic"></div>');
      item.append('<div class="pattern-title">' + pattern.name + '</div>');
      item.append('<div class="pattern-description">' + pattern.description + '</div>');
      container.append(item);
    });
  }
}

function updateEnhancedFacts(facts) {
  var container = $('#factsList');
  container.empty();
  
  facts.forEach(function(fact) {
    var item = $('<div class="fact-item enhanced"></div>');
    item.append('<div class="fact-title">' + fact.title + '</div>');
    item.append('<div class="fact-description">' + fact.description + '</div>');
    container.append(item);
  });
}

function createEnhancedCharts(charts, statistics) {
  // Create enhanced hourly chart
  createEnhancedHourlyChart(charts.hourlyDistribution, statistics);
  
  // Create enhanced daily chart
  createEnhancedDailyChart(charts.dailyTrends, statistics);
  
  // Create time series chart
  createTimeSeriesChart(charts.timeSeries, statistics);
  
  // Create glucose distribution chart
  createGlucoseDistributionChart(statistics);
}

function createEnhancedHourlyChart(hourlyData, statistics) {
  var container = $('#hourlyChart');
  container.empty();
  
  // Calculate hourly statistics
  var chartData = [];
  for (var hour = 0; hour < 24; hour++) {
    if (hourlyData[hour] && hourlyData[hour].length > 0) {
      var values = hourlyData[hour];
      var sum = values.reduce((a, b) => a + b, 0);
      var avg = sum / values.length;
      var variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
      var stdDev = Math.sqrt(variance);
      
      // Count high/low readings
      var highCount = values.filter(v => v >= statistics.targetHigh).length;
      var lowCount = values.filter(v => v < statistics.targetLow).length;
      
      chartData.push({
        hour: hour,
        average: avg,
        stdDev: stdDev,
        count: values.length,
        highCount: highCount,
        lowCount: lowCount,
        timeInRange: ((values.length - highCount - lowCount) / values.length) * 100
      });
    }
  }
  
  // Create enhanced table with more insights
  var table = $('<table class="enhanced-hourly-chart"></table>');
  var header = $('<tr><th>Hour</th><th>Avg Glucose</th><th>Variability</th><th>Time in Range</th><th>High</th><th>Low</th><th>Readings</th></tr>');
  table.append(header);
  
  chartData.forEach(function(hour) {
    var row = $('<tr></tr>');
    
    // Highlight problematic hours
    var rowClass = '';
    if (hour.timeInRange < 70) rowClass += ' low-tir';
    if (hour.stdDev > statistics.stdDev * 1.2) rowClass += ' high-variability';
    
    row.attr('class', rowClass);
    
    row.append('<td>' + hour.hour + ':00</td>');
    row.append('<td>' + formatGlucose(hour.average, getUserUnits()) + '</td>');
    row.append('<td>' + formatGlucose(hour.stdDev, getUserUnits()) + '</td>');
    row.append('<td>' + Math.round(hour.timeInRange) + '%</td>');
    row.append('<td>' + hour.highCount + '</td>');
    row.append('<td>' + hour.lowCount + '</td>');
    row.append('<td>' + hour.count + '</td>');
    
    table.append(row);
  });
  
  container.append(table);
  
  // Add insights
  var insights = $('<div class="chart-insights"></div>');
  var worstHour = chartData.reduce((worst, current) => 
    current.timeInRange < worst.timeInRange ? current : worst, chartData[0]);
  var bestHour = chartData.reduce((best, current) => 
    current.timeInRange > best.timeInRange ? current : best, chartData[0]);
  
  insights.append('<p><strong>Best performing hour:</strong> ' + bestHour.hour + ':00 (' + Math.round(bestHour.timeInRange) + '% TIR)</p>');
  insights.append('<p><strong>Most challenging hour:</strong> ' + worstHour.hour + ':00 (' + Math.round(worstHour.timeInRange) + '% TIR)</p>');
  
  container.append(insights);
}

function createEnhancedDailyChart(dailyData, statistics) {
  var container = $('#dailyChart');
  container.empty();
  
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var chartData = [];
  
  for (var day = 0; day < 7; day++) {
    if (dailyData[day] && dailyData[day].length > 0) {
      var values = dailyData[day];
      var sum = values.reduce((a, b) => a + b, 0);
      var avg = sum / values.length;
      var variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
      var stdDev = Math.sqrt(variance);
      
      var highCount = values.filter(v => v >= statistics.targetHigh).length;
      var lowCount = values.filter(v => v < statistics.targetLow).length;
      var timeInRange = ((values.length - highCount - lowCount) / values.length) * 100;
      
      chartData.push({
        day: day,
        dayName: dayNames[day],
        average: avg,
        stdDev: stdDev,
        count: values.length,
        highCount: highCount,
        lowCount: lowCount,
        timeInRange: timeInRange
      });
    }
  }
  
  // Create enhanced table
  var table = $('<table class="enhanced-daily-chart"></table>');
  var header = $('<tr><th>Day</th><th>Avg Glucose</th><th>Variability</th><th>Time in Range</th><th>High</th><th>Low</th><th>Readings</th></tr>');
  table.append(header);
  
  chartData.forEach(function(day) {
    var row = $('<tr></tr>');
    
    // Highlight problematic days
    var rowClass = '';
    if (day.timeInRange < 70) rowClass += ' low-tir';
    if (day.stdDev > statistics.stdDev * 1.2) rowClass += ' high-variability';
    
    row.attr('class', rowClass);
    
    row.append('<td>' + day.dayName + '</td>');
    row.append('<td>' + formatGlucose(day.average, getUserUnits()) + '</td>');
    row.append('<td>' + formatGlucose(day.stdDev, getUserUnits()) + '</td>');
    row.append('<td>' + Math.round(day.timeInRange) + '%</td>');
    row.append('<td>' + day.highCount + '</td>');
    row.append('<td>' + day.lowCount + '</td>');
    row.append('<td>' + day.count + '</td>');
    
    table.append(row);
  });
  
  container.append(table);
  
  // Add insights
  var insights = $('<div class="chart-insights"></div>');
  var worstDay = chartData.reduce((worst, current) => 
    current.timeInRange < worst.timeInRange ? current : worst, chartData[0]);
  var bestDay = chartData.reduce((best, current) => 
    current.timeInRange > best.timeInRange ? current : best, chartData[0]);
  
  insights.append('<p><strong>Best performing day:</strong> ' + bestDay.dayName + ' (' + Math.round(bestDay.timeInRange) + '% TIR)</p>');
  insights.append('<p><strong>Most challenging day:</strong> ' + worstDay.dayName + ' (' + Math.round(worstDay.timeInRange) + '% TIR)</p>');
  
  container.append(insights);
}

function createTimeSeriesChart(timeSeries, statistics) {
  var container = $('#timeSeriesChart');
  if (container.length === 0) {
    container = $('<div id="timeSeriesChart" class="chart-container"></div>');
    $('#content').append(container);
  }
  
  container.empty();
  container.append('<h3>Glucose Timeline</h3>');
  
  if (typeof Chart !== 'undefined') {
    var ctx = $('<canvas style="width: 100%; height: 300px;"></canvas>');
    container.append(ctx);
    
    var chartData = timeSeries.map(point => ({
      x: new Date(point.timestamp),
      y: point.value
    }));
    
    new Chart(ctx[0], {
      type: 'line',
      data: {
        datasets: [{
          label: 'Glucose',
          data: chartData,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                hour: 'HH:mm',
                day: 'MMM DD'
              }
            },
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Glucose (' + (getUserUnits() === 'mmol' ? 'mmol/L' : 'mg/dL') + ')'
            },
            grid: {
              color: function(context) {
                var value = context.tick.value;
                if (value >= statistics.targetHigh) return 'rgba(255, 0, 0, 0.2)';
                if (value < statistics.targetLow) return 'rgba(0, 0, 255, 0.2)';
                return 'rgba(0, 255, 0, 0.2)';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Glucose: ' + formatGlucose(context.parsed.y, getUserUnits());
              }
            }
          }
        }
      }
    });
  }
}

function createGlucoseDistributionChart(statistics) {
  var container = $('#glucoseDistributionChart');
  if (container.length === 0) {
    container = $('<div id="glucoseDistributionChart" class="chart-container"></div>');
    $('#content').append(container);
  }
  
  container.empty();
  container.append('<h3>Glucose Distribution</h3>');
  
  // Create distribution histogram
  var distributionData = calculateGlucoseDistribution(statistics);
  
  var table = $('<table class="distribution-chart"></table>');
  var header = $('<tr><th>Range</th><th>Count</th><th>Percentage</th><th>Visual</th></tr>');
  table.append(header);
  
  distributionData.forEach(function(bin) {
    var row = $('<tr></tr>');
    row.append('<td>' + bin.range + '</td>');
    row.append('<td>' + bin.count + '</td>');
    row.append('<td>' + bin.percentage.toFixed(1) + '%</td>');
    
    var visual = $('<td><div class="distribution-bar"></div></td>');
    visual.find('.distribution-bar').css({
      width: bin.percentage + '%',
      backgroundColor: bin.color
    });
    row.append(visual);
    
    table.append(row);
  });
  
  container.append(table);
}

function calculateGlucoseDistribution(statistics) {
  // This would need actual glucose values to create a proper histogram
  // For now, return mock data based on statistics
  var ranges = [
    { min: 0, max: statistics.targetLow, label: 'Low (<' + statistics.targetLow + ')', color: '#3498db' },
    { min: statistics.targetLow, max: statistics.targetHigh, label: 'In Range (' + statistics.targetLow + '-' + statistics.targetHigh + ')', color: '#2ecc71' },
    { min: statistics.targetHigh, max: 400, label: 'High (>' + statistics.targetHigh + ')', color: '#e74c3c' }
  ];
  
  return ranges.map(range => ({
    range: range.label,
    count: range.min === 0 ? statistics.lowCount : 
           range.min === statistics.targetLow ? statistics.inRangeCount : 
           statistics.highCount,
    percentage: range.min === 0 ? (statistics.lowCount / statistics.total) * 100 :
                range.min === statistics.targetLow ? (statistics.inRangeCount / statistics.total) * 100 :
                (statistics.highCount / statistics.total) * 100,
    color: range.color
  }));
}

async function loadWeeklyComparison() {
  showLoading();
  
  try {
    const response = await fetch(`${weeklySummaryEnhanced.apiBaseUrl}/compare?weeks=4`, {
      headers: weeklySummaryEnhanced.client ? weeklySummaryEnhanced.client.headers() : {}
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    displayWeeklyComparison(data);
    
  } catch (error) {
    console.error('Error loading weekly comparison:', error);
    showError('Failed to load weekly comparison: ' + error.message);
  }
}

function displayWeeklyComparison(data) {
  var container = $('#weeklyComparison');
  if (container.length === 0) {
    container = $('<div id="weeklyComparison" class="comparison-container"></div>');
    $('#content').prepend(container);
  }
  
  container.empty();
  container.append('<h2>Weekly Comparison</h2>');
  
  // Create comparison table
  var table = $('<table class="comparison-table"></table>');
  var header = $('<tr><th>Week</th><th>Time in Range</th><th>Avg Glucose</th><th>Variability</th><th>Trend</th></tr>');
  table.append(header);
  
  data.comparisons.forEach(function(week, index) {
    if (week.error) return;
    
    var row = $('<tr></tr>');
    row.append('<td>Week ' + (index + 1) + '</td>');
    row.append('<td>' + Math.round(week.statistics.timeInRange) + '%</td>');
    row.append('<td>' + formatGlucose(week.statistics.mean, getUserUnits()) + '</td>');
    row.append('<td>' + formatGlucose(week.statistics.stdDev, getUserUnits()) + '</td>');
    
    // Add trend indicators
    var trendIndicator = '';
    if (index < data.comparisons.length - 1) {
      var currentTir = week.statistics.timeInRange;
      var previousTir = data.comparisons[index + 1].statistics.timeInRange;
      
      if (currentTir > previousTir + 5) trendIndicator = '↗️ Improving';
      else if (currentTir < previousTir - 5) trendIndicator = '↘️ Declining';
      else trendIndicator = '→ Stable';
    }
    
    row.append('<td>' + trendIndicator + '</td>');
    table.append(row);
  });
  
  container.append(table);
  
  // Add trend analysis
  if (data.trendAnalysis && !data.trendAnalysis.error) {
    var trendDiv = $('<div class="trend-analysis"></div>');
    trendDiv.append('<h3>Trend Analysis</h3>');
    trendDiv.append('<p><strong>Time in Range:</strong> ' + data.trendAnalysis.timeInRange.trend + '</p>');
    trendDiv.append('<p><strong>Average Glucose:</strong> ' + data.trendAnalysis.averageGlucose.trend + '</p>');
    container.append(trendDiv);
  }
  
  showContent();
}

function updateMetadata(metadata) {
  var container = $('#metadata');
  if (container.length === 0) {
    container = $('<div id="metadata" class="metadata-info"></div>');
    $('#content').append(container);
  }
  
  container.empty();
  container.append('<h4>Data Information</h4>');
  container.append('<p><strong>Generated:</strong> ' + new Date(metadata.generatedAt).toLocaleString() + '</p>');
  container.append('<p><strong>Data Completeness:</strong> ' + Math.round(metadata.dataCompleteness * 100) + '%</p>');
  if (metadata.processingTime) {
    container.append('<p><strong>Processing Time:</strong> ' + metadata.processingTime + 'ms</p>');
  }
}

// Helper functions
function formatGlucose(value, units) {
  if (units === 'mmol') {
    return (value / 18).toFixed(1) + ' mmol/L';
  } else {
    return Math.round(value) + ' mg/dL';
  }
}

function formatChangeRate(rate, units) {
  if (units === 'mmol') {
    return (rate / 18).toFixed(3) + ' mmol/L/min';
  } else {
    return rate.toFixed(1) + ' mg/dL/min';
  }
}

function calculateVariabilityScore(statistics) {
  var cv = (statistics.stdDev / statistics.mean) * 100;
  if (cv < 20) return 'Low';
  if (cv < 35) return 'Moderate';
  return 'High';
}

function getUserUnits() {
  if (weeklySummaryEnhanced.client && weeklySummaryEnhanced.client.settings && weeklySummaryEnhanced.client.settings.units) {
    return weeklySummaryEnhanced.client.settings.units;
  }
  try {
    return localStorage.getItem('units') || 'mg/dl';
  } catch (e) {
    return 'mg/dl';
  }
}

function updateDateRange(start, end) {
  var startStr = start.toLocaleDateString();
  var endStr = end.toLocaleDateString();
  $('#dateRange').text(startStr + ' to ' + endStr);
}

function showLoading() {
  $('#loading').show();
  $('#error').hide();
  $('#content').hide();
}

function showContent() {
  $('#loading').hide();
  $('#error').hide();
  $('#content').show();
}

function showError(message) {
  $('#loading').hide();
  $('#content').hide();
  $('#error').show();
  $('#errorMessage').text(message);
}

// Initialize when document is ready
$(document).ready(function() {
  init();
});
