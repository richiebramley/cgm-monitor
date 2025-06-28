'use strict';

var weeklySummary = {
  currentWeekStart: null,
  client: null,
  settings: null
};

function init() {
  console.log('Initializing Weekly Summary');
  
  // Initialize with current week (Monday to Sunday)
  var now = new Date();
  var dayOfWeek = now.getDay();
  var daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so we need 6 days back
  weeklySummary.currentWeekStart = new Date(now);
  weeklySummary.currentWeekStart.setDate(now.getDate() - daysToMonday);
  weeklySummary.currentWeekStart.setHours(0, 0, 0, 0);
  
  // Debug current settings
  debugSettings();
  
  // Initialize client and settings - wait for client to be available
  if (window.Nightscout && window.Nightscout.client) {
    weeklySummary.client = window.Nightscout.client;
    weeklySummary.settings = weeklySummary.client.settings;
    console.log('Client found immediately, settings:', weeklySummary.settings);
    debugSettings();
    setupEventListeners();
    loadWeeklyData();
  } else {
    // Wait for client to be available
    var checkClient = setInterval(function() {
      if (window.Nightscout && window.Nightscout.client) {
        weeklySummary.client = window.Nightscout.client;
        weeklySummary.settings = weeklySummary.client.settings;
        console.log('Client found after waiting, settings:', weeklySummary.settings);
        debugSettings();
        clearInterval(checkClient);
        setupEventListeners();
        loadWeeklyData();
      }
    }, 100);
  }
}

function setupEventListeners() {
  $('#prevWeek').click(function() {
    weeklySummary.currentWeekStart.setDate(weeklySummary.currentWeekStart.getDate() - 7);
    loadWeeklyData();
    updateWeekSelector();
  });
  
  $('#currentWeek').click(function() {
    var now = new Date();
    var dayOfWeek = now.getDay();
    var daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weeklySummary.currentWeekStart = new Date(now);
    weeklySummary.currentWeekStart.setDate(now.getDate() - daysToMonday);
    weeklySummary.currentWeekStart.setHours(0, 0, 0, 0);
    loadWeeklyData();
    updateWeekSelector();
  });
  
  $('#nextWeek').click(function() {
    weeklySummary.currentWeekStart.setDate(weeklySummary.currentWeekStart.getDate() + 7);
    loadWeeklyData();
    updateWeekSelector();
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
  
  if (weeklySummary.currentWeekStart.getTime() === currentWeekStart.getTime()) {
    $('#currentWeek').addClass('active');
  } else if (weeklySummary.currentWeekStart.getTime() < currentWeekStart.getTime()) {
    $('#prevWeek').addClass('active');
  } else {
    $('#nextWeek').addClass('active');
  }
}

function loadWeeklyData() {
  showLoading();
  
  var weekEnd = new Date(weeklySummary.currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  updateDateRange(weeklySummary.currentWeekStart, weekEnd);
  
  // Get user's preferred units
  var units = getUserUnits();
  
  // Set appropriate target ranges based on units
  var targetLow, targetHigh;
  if (units === 'mmol') {
    // Use mmol/L thresholds
    targetLow = 4.0;
    targetHigh = 10.0;
  } else {
    // Use mg/dL thresholds (convert from mmol/L if needed)
    targetLow = weeklySummary.client && weeklySummary.client.settings ? weeklySummary.client.settings.thresholds.bgLow : 72; // 4.0 * 18
    targetHigh = weeklySummary.client && weeklySummary.client.settings ? weeklySummary.client.settings.thresholds.bgHigh : 180; // 10.0 * 18
  }
  
  console.log('Using target ranges:', targetLow, 'to', targetHigh, 'in units:', units);
  
  // Load data for the week
  var fromDate = weeklySummary.currentWeekStart.toISOString();
  var toDate = weekEnd.toISOString();
  
  var query = '/api/v1/entries.json?find[dateString][$gte]=' + 
              weeklySummary.currentWeekStart.toISOString().split('T')[0] + 
              '&find[dateString][$lte]=' + weekEnd.toISOString().split('T')[0] + 
              '&count=10000';
  
  $.ajax({
    url: query,
    headers: weeklySummary.client ? weeklySummary.client.headers() : {},
    success: function(data) {
      processWeeklyData(data, targetLow, targetHigh);
    },
    error: function(xhr, status, error) {
      showError('Failed to load data: ' + error);
    }
  });
}

function processWeeklyData(data, targetLow, targetHigh) {
  try {
    // Filter for SGV entries only
    var sgvData = data.filter(function(entry) {
      return entry.type === 'sgv' && entry.sgv;
    });
    
    if (sgvData.length === 0) {
      showError('No glucose data available for the selected week.');
      return;
    }
    
    console.log('Raw SGV data sample:', sgvData.slice(0, 5));
    
    // Convert to numbers and filter out invalid values
    sgvData = sgvData.map(function(entry) {
      return {
        sgv: parseFloat(entry.sgv),
        date: new Date(entry.dateString),
        mills: entry.mills || new Date(entry.dateString).getTime()
      };
    }).filter(function(entry) {
      return !isNaN(entry.sgv) && entry.sgv > 0;
    });
    
    console.log('Processed SGV data sample:', sgvData.slice(0, 5));
    console.log('Target ranges for comparison:', targetLow, 'to', targetHigh);
    
    // Calculate statistics
    var stats = calculateStatistics(sgvData, targetLow, targetHigh);
    
    // Generate recommendations
    var recommendations = generateRecommendations(stats, targetLow, targetHigh);
    
    // Update UI
    updateStatistics(stats);
    updateRecommendations(recommendations);
    createCharts(sgvData, targetLow, targetHigh);
    
    showContent();
    
  } catch (error) {
    console.error('Error processing weekly data:', error);
    showError('Error processing data: ' + error.message);
  }
}

function calculateStatistics(data, targetLow, targetHigh) {
  var values = data.map(function(d) { return d.sgv; });
  var total = values.length;
  var units = getUserUnits();
  
  console.log('Calculating statistics with thresholds:', targetLow, 'to', targetHigh, 'for', total, 'readings');
  console.log('User units:', units);
  console.log('Sample glucose values (raw):', values.slice(0, 10));
  
  // Convert values to user's preferred units for comparison
  var convertedValues = values.map(function(value) {
    if (units === 'mmol') {
      return value / 18; // Convert mg/dL to mmol/L
    } else {
      return value; // Keep as mg/dL
    }
  });
  
  console.log('Sample glucose values (converted to', units, '):', convertedValues.slice(0, 10));
  
  // Basic statistics (use converted values for mean/stdDev)
  var sum = convertedValues.reduce(function(a, b) { return a + b; }, 0);
  var mean = sum / total;
  
  // Standard deviation
  var variance = convertedValues.reduce(function(acc, val) {
    return acc + Math.pow(val - mean, 2);
  }, 0) / total;
  var stdDev = Math.sqrt(variance);
  
  // Range analysis with detailed debugging (use converted values)
  var lowValues = convertedValues.filter(function(v) { return v < targetLow; });
  var highValues = convertedValues.filter(function(v) { return v >= targetHigh; });
  var inRangeValues = convertedValues.filter(function(v) { return v >= targetLow && v < targetHigh; });
  
  var lowCount = lowValues.length;
  var highCount = highValues.length;
  var inRangeCount = inRangeValues.length;
  
  console.log('Range analysis details (using', units, 'values):');
  console.log('- Low values (<', targetLow, '):', lowCount, 'samples:', lowValues.slice(0, 5));
  console.log('- In range values (>=', targetLow, 'and <', targetHigh, '):', inRangeCount, 'samples:', inRangeValues.slice(0, 5));
  console.log('- High values (>=', targetHigh, '):', highCount, 'samples:', highValues.slice(0, 5));
  
  // Time in range percentage
  var timeInRange = (inRangeCount / total) * 100;
  
  console.log('Final time in range calculation:', inRangeCount, '/', total, '=', timeInRange, '%');
  
  // Min and max (use converted values)
  var min = Math.min.apply(null, convertedValues);
  var max = Math.max.apply(null, convertedValues);
  
  // Hourly distribution
  var hourlyData = {};
  for (var i = 0; i < 24; i++) {
    hourlyData[i] = [];
  }
  
  data.forEach(function(entry) {
    var hour = entry.date.getHours();
    hourlyData[hour].push(entry.sgv);
  });
  
  // Daily averages
  var dailyData = {};
  for (var i = 0; i < 7; i++) {
    dailyData[i] = [];
  }
  
  data.forEach(function(entry) {
    var dayOfWeek = entry.date.getDay();
    dailyData[dayOfWeek].push(entry.sgv);
  });
  
  return {
    total: total,
    mean: mean,
    stdDev: stdDev,
    min: min,
    max: max,
    lowCount: lowCount,
    highCount: highCount,
    inRangeCount: inRangeCount,
    timeInRange: timeInRange,
    targetLow: targetLow,
    targetHigh: targetHigh,
    hourlyData: hourlyData,
    dailyData: dailyData,
    rawData: data
  };
}

function generateRecommendations(stats, targetLow, targetHigh) {
  var recommendations = [];
  
  // Time in range recommendations
  if (stats.timeInRange < 70) {
    recommendations.push({
      type: 'alert',
      title: 'Low Time in Range',
      description: 'Only ' + Math.round(stats.timeInRange) + '% of readings were within your target range. Consider reviewing your insulin dosing and meal timing.'
    });
  } else if (stats.timeInRange < 80) {
    recommendations.push({
      type: 'warning',
      title: 'Moderate Time in Range',
      description: 'Your time in range is ' + Math.round(stats.timeInRange) + '%. Aim for 80% or higher for optimal diabetes management.'
    });
  } else {
    recommendations.push({
      type: 'success',
      title: 'Excellent Time in Range',
      description: 'Great job! You achieved ' + Math.round(stats.timeInRange) + '% time in range this week.'
    });
  }
  
  // High readings recommendations
  if (stats.highCount > stats.total * 0.3) {
    recommendations.push({
      type: 'alert',
      title: 'Frequent High Readings',
      description: stats.highCount + ' readings (' + Math.round((stats.highCount / stats.total) * 100) + '%) were above your target range. Consider adjusting your insulin sensitivity or carb ratios.'
    });
  }
  
  // Low readings recommendations
  if (stats.lowCount > stats.total * 0.1) {
    recommendations.push({
      type: 'alert',
      title: 'Frequent Low Readings',
      description: stats.lowCount + ' readings (' + Math.round((stats.lowCount / stats.total) * 100) + '%) were below your target range. Consider reducing your insulin doses or increasing your target range.'
    });
  }
  
  // Variability recommendations
  if (stats.stdDev > targetHigh * 0.3) {
    recommendations.push({
      type: 'warning',
      title: 'High Glucose Variability',
      description: 'Your glucose levels show high variability (SD: ' + (getUserUnits() === 'mmol' ? stats.stdDev.toFixed(1) : Math.round(stats.stdDev)) + '). Consider more consistent meal timing and insulin dosing.'
    });
  }
  
  // Data completeness
  var expectedReadings = 7 * 24 * 12; // 7 days * 24 hours * 12 readings per hour (5-minute intervals)
  var completeness = (stats.total / expectedReadings) * 100;
  
  if (completeness < 80) {
    recommendations.push({
      type: 'warning',
      title: 'Incomplete Data',
      description: 'Only ' + Math.round(completeness) + '% of expected readings were available. Check your CGM sensor and data upload.'
    });
  }
  
  // Average glucose recommendations
  if (stats.mean > targetHigh * 1.1) {
    recommendations.push({
      type: 'warning',
      title: 'High Average Glucose',
      description: 'Your average glucose of ' + (getUserUnits() === 'mmol' ? stats.mean.toFixed(1) : Math.round(stats.mean)) + ' is above your target range. Consider adjusting your basal rates or meal boluses.'
    });
  } else if (stats.mean < targetLow * 0.9) {
    recommendations.push({
      type: 'warning',
      title: 'Low Average Glucose',
      description: 'Your average glucose of ' + (getUserUnits() === 'mmol' ? stats.mean.toFixed(1) : Math.round(stats.mean)) + ' is below your target range. Consider reducing your insulin doses.'
    });
  }
  
  // Trend analysis
  var trendAnalysis = analyzeTrends(stats.rawData);
  if (trendAnalysis.hasSignificantTrends) {
    recommendations.push({
      type: 'warning',
      title: 'Trend Analysis',
      description: trendAnalysis.description
    });
  }
  
  return recommendations;
}

function analyzeTrends(data) {
  // Simple trend analysis - look for patterns in the data
  var result = {
    hasSignificantTrends: false,
    description: ''
  };
  
  if (data.length < 10) {
    return result;
  }
  
  // Sort data by time
  data.sort(function(a, b) {
    return a.mills - b.mills;
  });
  
  // Calculate moving average to detect trends
  var windowSize = Math.min(20, Math.floor(data.length / 4));
  var movingAverages = [];
  
  for (var i = windowSize; i < data.length; i++) {
    var sum = 0;
    for (var j = i - windowSize; j < i; j++) {
      sum += data[j].sgv;
    }
    movingAverages.push(sum / windowSize);
  }
  
  if (movingAverages.length < 2) {
    return result;
  }
  
  // Check for upward or downward trends
  var firstHalf = movingAverages.slice(0, Math.floor(movingAverages.length / 2));
  var secondHalf = movingAverages.slice(Math.floor(movingAverages.length / 2));
  
  var firstAvg = firstHalf.reduce(function(a, b) { return a + b; }, 0) / firstHalf.length;
  var secondAvg = secondHalf.reduce(function(a, b) { return a + b; }, 0) / secondHalf.length;
  
  var change = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (Math.abs(change) > 10) {
    result.hasSignificantTrends = true;
    if (change > 0) {
      result.description = 'Your glucose levels show an upward trend of ' + Math.round(change) + '%. Consider reviewing your insulin dosing.';
    } else {
      result.description = 'Your glucose levels show a downward trend of ' + Math.round(Math.abs(change)) + '%. Consider reducing your insulin doses.';
    }
  }
  
  return result;
}

function updateStatistics(stats) {
  // Get user's preferred units from client settings
  var units = getUserUnits();
  
  // The stats.mean and stats.stdDev are already in the correct units from calculateStatistics
  // Just format them for display
  var avgGlucose = units === 'mmol' ? stats.mean.toFixed(1) : Math.round(stats.mean);
  var stdDev = units === 'mmol' ? stats.stdDev.toFixed(1) : Math.round(stats.stdDev);
  
  $('#timeInRange').text(Math.round(stats.timeInRange) + '%');
  $('#avgGlucose').text(avgGlucose);
  $('#stdDev').text(stdDev);
  $('#totalReadings').text(stats.total);
  $('#highReadings').text(stats.highCount + ' (' + Math.round((stats.highCount / stats.total) * 100) + '%)');
  $('#lowReadings').text(stats.lowCount + ' (' + Math.round((stats.lowCount / stats.total) * 100) + '%)');
}

function convertToUserUnits(value, units) {
  if (units === 'mmol') {
    // Convert from mg/dL to mmol/L (divide by 18)
    return (Math.round((value / 18) * 10) / 10).toFixed(1);
  } else {
    // Keep as mg/dL
    return Math.round(value);
  }
}

function updateRecommendations(recommendations) {
  var container = $('#recommendationsList');
  container.empty();
  
  if (recommendations.length === 0) {
    container.append('<div class="recommendation-item"><div class="recommendation-title">No specific recommendations</div><div class="recommendation-description">Your data looks good! Keep up the great work.</div></div>');
    return;
  }
  
  recommendations.forEach(function(rec) {
    var item = $('<div class="recommendation-item ' + rec.type + '"></div>');
    item.append('<div class="recommendation-title">' + rec.title + '</div>');
    item.append('<div class="recommendation-description">' + rec.description + '</div>');
    container.append(item);
  });
}

function createCharts(data, targetLow, targetHigh) {
  // Daily trends chart
  createDailyChart(data, targetLow, targetHigh);
  
  // Hourly distribution chart
  createHourlyChart(data, targetLow, targetHigh);
}

function createDailyChart(data, targetLow, targetHigh) {
  // Get user's preferred units from client settings
  var units = getUserUnits();
  
  // Group data by day of week
  var dailyAverages = {};
  var dailyCounts = {};
  
  for (var i = 0; i < 7; i++) {
    dailyAverages[i] = 0;
    dailyCounts[i] = 0;
  }
  
  data.forEach(function(entry) {
    var day = entry.date.getDay();
    dailyAverages[day] += entry.sgv;
    dailyCounts[day]++;
  });
  
  // Calculate averages
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var chartData = [];
  
  for (var i = 0; i < 7; i++) {
    if (dailyCounts[i] > 0) {
      chartData.push({
        day: dayNames[i],
        average: dailyAverages[i] / dailyCounts[i],
        count: dailyCounts[i]
      });
    }
  }
  
  // Simple chart using HTML/CSS
  var container = $('#dailyChart');
  container.empty();
  
  var table = $('<table style="width: 100%; border-collapse: collapse;"></table>');
  var header = $('<tr><th style="padding: 10px; border: 1px solid #ddd;">Day</th><th style="padding: 10px; border: 1px solid #ddd;">Average</th><th style="padding: 10px; border: 1px solid #ddd;">Readings</th></tr>');
  table.append(header);
  
  chartData.forEach(function(day) {
    var row = $('<tr></tr>');
    row.append('<td style="padding: 10px; border: 1px solid #ddd;">' + day.day + '</td>');
    row.append('<td style="padding: 10px; border: 1px solid #ddd;">' + convertToUserUnits(day.average, units) + '</td>');
    row.append('<td style="padding: 10px; border: 1px solid #ddd;">' + day.count + '</td>');
    table.append(row);
  });
  
  container.append(table);
}

function createHourlyChart(data, targetLow, targetHigh) {
  // Get user's preferred units from client settings
  var units = getUserUnits();
  
  // Group data by hour
  var hourlyAverages = {};
  var hourlyCounts = {};
  
  for (var i = 0; i < 24; i++) {
    hourlyAverages[i] = 0;
    hourlyCounts[i] = 0;
  }
  
  data.forEach(function(entry) {
    var hour = entry.date.getHours();
    hourlyAverages[hour] += entry.sgv;
    hourlyCounts[hour]++;
  });
  
  // Calculate averages
  var chartData = [];
  for (var i = 0; i < 24; i++) {
    if (hourlyCounts[i] > 0) {
      chartData.push({
        hour: i,
        average: hourlyAverages[i] / hourlyCounts[i],
        count: hourlyCounts[i]
      });
    }
  }
  
  // Simple chart using HTML/CSS
  var container = $('#hourlyChart');
  container.empty();
  
  var table = $('<table style="width: 100%; border-collapse: collapse;"></table>');
  var header = $('<tr><th style="padding: 8px; border: 1px solid #ddd;">Hour</th><th style="padding: 8px; border: 1px solid #ddd;">Average</th><th style="padding: 8px; border: 1px solid #ddd;">Readings</th></tr>');
  table.append(header);
  
  chartData.forEach(function(hour) {
    var row = $('<tr></tr>');
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + hour.hour + ':00</td>');
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + convertToUserUnits(hour.average, units) + '</td>');
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + hour.count + '</td>');
    table.append(row);
  });
  
  container.append(table);
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

// Helper function to get user units with fallback
function getUserUnits() {
  // TEMPORARY: Force mmol/L for testing
  console.log('FORCING mmol/L FOR TESTING');
  return 'mmol';
  
  // Try to get from client settings first
  if (weeklySummary.client && weeklySummary.client.settings && weeklySummary.client.settings.units) {
    console.log('Getting units from client settings:', weeklySummary.client.settings.units);
    return weeklySummary.client.settings.units;
  }
  
  // Fallback to localStorage
  try {
    var storedUnits = localStorage.getItem('units');
    console.log('Getting units from localStorage:', storedUnits);
    return storedUnits || 'mg/dl';
  } catch (e) {
    console.log('Error accessing localStorage, using default mg/dl');
    return 'mg/dl';
  }
}

// Debug function to show all available settings
function debugSettings() {
  console.log('=== DEBUG SETTINGS ===');
  console.log('weeklySummary.client:', weeklySummary.client);
  if (weeklySummary.client) {
    console.log('weeklySummary.client.settings:', weeklySummary.client.settings);
  }
  console.log('weeklySummary.settings:', weeklySummary.settings);
  
  try {
    console.log('localStorage units:', localStorage.getItem('units'));
    console.log('localStorage keys:', Object.keys(localStorage));
  } catch (e) {
    console.log('Error accessing localStorage:', e);
  }
  console.log('=== END DEBUG ===');
}

// Initialize when document is ready
$(document).ready(function() {
  init();
}); 