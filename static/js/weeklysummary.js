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
  
  // Calculate time duration for high and low readings
  // Assuming 5-minute intervals between readings (typical CGM frequency)
  var readingIntervalMinutes = 5;
  var lowTimeMinutes = lowCount * readingIntervalMinutes;
  var highTimeMinutes = highCount * readingIntervalMinutes;
  
  // Convert to hours and minutes for display
  var lowTimeHours = Math.floor(lowTimeMinutes / 60);
  var lowTimeRemainingMinutes = lowTimeMinutes % 60;
  var highTimeHours = Math.floor(highTimeMinutes / 60);
  var highTimeRemainingMinutes = highTimeMinutes % 60;
  
  // Format time strings
  var lowTimeString = '';
  if (lowTimeHours > 0) {
    lowTimeString = lowTimeHours + 'h ' + lowTimeRemainingMinutes + 'm';
  } else {
    lowTimeString = lowTimeRemainingMinutes + 'm';
  }
  
  var highTimeString = '';
  if (highTimeHours > 0) {
    highTimeString = highTimeHours + 'h ' + highTimeRemainingMinutes + 'm';
  } else {
    highTimeString = highTimeRemainingMinutes + 'm';
  }
  
  console.log('Range analysis details (using', units, 'values):');
  console.log('- Low values (<', targetLow, '):', lowCount, 'samples:', lowValues.slice(0, 5));
  console.log('- In range values (>=', targetLow, 'and <', targetHigh, '):', inRangeCount, 'samples:', inRangeValues.slice(0, 5));
  console.log('- High values (>=', targetHigh, '):', highCount, 'samples:', highValues.slice(0, 5));
  console.log('- Low time duration:', lowTimeString, '(', lowTimeMinutes, 'minutes)');
  console.log('- High time duration:', highTimeString, '(', highTimeMinutes, 'minutes)');
  
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
  
  // Calculate glucose change rates between consecutive readings
  var changeRates = [];
  var risingRates = [];
  var fallingRates = [];
  
  // Sort data by timestamp to ensure chronological order
  var sortedData = data.slice().sort(function(a, b) {
    return a.mills - b.mills;
  });
  
  // Calculate change rates between consecutive readings
  for (var i = 1; i < sortedData.length; i++) {
    var currentReading = sortedData[i];
    var previousReading = sortedData[i - 1];
    
    // Calculate time difference in minutes
    var timeDiffMinutes = (currentReading.mills - previousReading.mills) / (1000 * 60);
    
    // Skip if time difference is too large (more than 15 minutes) or too small
    if (timeDiffMinutes < 3 || timeDiffMinutes > 15) {
      continue;
    }
    
    // Calculate glucose change
    var glucoseChange = currentReading.sgv - previousReading.sgv;
    
    // Calculate rate of change per minute
    var ratePerMinute = glucoseChange / timeDiffMinutes;
    
    // Convert to user's preferred units for display
    var displayRate = units === 'mmol' ? ratePerMinute / 18 : ratePerMinute;
    
    changeRates.push({
      rate: displayRate,
      timeDiff: timeDiffMinutes,
      glucoseChange: glucoseChange,
      timestamp: currentReading.mills
    });
    
    // Categorize as rising or falling
    if (ratePerMinute > 0) {
      risingRates.push(displayRate);
    } else if (ratePerMinute < 0) {
      fallingRates.push(Math.abs(displayRate)); // Store absolute value for falling rates
    }
  }
  
  // Calculate statistics for rising and falling rates
  var risingRateStats = {
    count: risingRates.length,
    mean: risingRates.length > 0 ? risingRates.reduce(function(a, b) { return a + b; }, 0) / risingRates.length : 0,
    max: risingRates.length > 0 ? Math.max.apply(null, risingRates) : 0,
    median: risingRates.length > 0 ? risingRates.sort(function(a, b) { return a - b; })[Math.floor(risingRates.length / 2)] : 0
  };
  
  var fallingRateStats = {
    count: fallingRates.length,
    mean: fallingRates.length > 0 ? fallingRates.reduce(function(a, b) { return a + b; }, 0) / fallingRates.length : 0,
    max: fallingRates.length > 0 ? Math.max.apply(null, fallingRates) : 0,
    median: fallingRates.length > 0 ? fallingRates.sort(function(a, b) { return a - b; })[Math.floor(fallingRates.length / 2)] : 0
  };
  
  // Calculate percentage of readings with significant change rates
  var significantRisingThreshold = units === 'mmol' ? 0.1 : 2; // 0.1 mmol/L/min or 2 mg/dL/min
  var significantFallingThreshold = units === 'mmol' ? 0.1 : 2;
  
  var significantRisingCount = risingRates.filter(function(rate) { return rate >= significantRisingThreshold; }).length;
  var significantFallingCount = fallingRates.filter(function(rate) { return rate >= significantFallingThreshold; }).length;
  
  var significantRisingPercentage = risingRates.length > 0 ? (significantRisingCount / risingRates.length) * 100 : 0;
  var significantFallingPercentage = fallingRates.length > 0 ? (significantFallingCount / fallingRates.length) * 100 : 0;
  
  console.log('Glucose change rate analysis:');
  console.log('- Total change rate calculations:', changeRates.length);
  console.log('- Rising rates:', risingRates.length, 'readings, mean:', risingRateStats.mean.toFixed(2), 'max:', risingRateStats.max.toFixed(2));
  console.log('- Falling rates:', fallingRates.length, 'readings, mean:', fallingRateStats.mean.toFixed(2), 'max:', fallingRateStats.max.toFixed(2));
  console.log('- Significant rising (>=' + significantRisingThreshold + '):', significantRisingCount, '(', significantRisingPercentage.toFixed(1) + '%)');
  console.log('- Significant falling (>=' + significantFallingThreshold + '):', significantFallingCount, '(', significantFallingPercentage.toFixed(1) + '%)');
  
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
    lowTimeString: lowTimeString,
    highTimeString: highTimeString,
    risingRateStats: risingRateStats,
    fallingRateStats: fallingRateStats,
    significantRisingPercentage: significantRisingPercentage,
    significantFallingPercentage: significantFallingPercentage,
    significantRisingThreshold: significantRisingThreshold,
    significantFallingThreshold: significantFallingThreshold,
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
  
  // Glucose change rate recommendations
  if (stats.risingRateStats && stats.risingRateStats.count > 0) {
    var risingThreshold = getUserUnits() === 'mmol' ? 0.1 : 2; // 0.1 mmol/L/min or 2 mg/dL/min
    var risingRate = stats.risingRateStats.mean;
    
    if (risingRate > risingThreshold * 1.5) {
      recommendations.push({
        type: 'warning',
        title: 'High Glucose Rising Rate',
        description: 'Your glucose rises at an average rate of ' + (getUserUnits() === 'mmol' ? risingRate.toFixed(3) : risingRate.toFixed(1)) + ' per minute. Consider pre-bolusing insulin or reducing carb intake.'
      });
    } else if (risingRate > risingThreshold) {
      recommendations.push({
        type: 'warning',
        title: 'Moderate Glucose Rising Rate',
        description: 'Your glucose rises at an average rate of ' + (getUserUnits() === 'mmol' ? risingRate.toFixed(3) : risingRate.toFixed(1)) + ' per minute. Monitor your post-meal glucose patterns.'
      });
    }
  }
  
  if (stats.fallingRateStats && stats.fallingRateStats.count > 0) {
    var fallingThreshold = getUserUnits() === 'mmol' ? 0.1 : 2; // 0.1 mmol/L/min or 2 mg/dL/min
    var fallingRate = stats.fallingRateStats.mean;
    
    if (fallingRate > fallingThreshold * 1.5) {
      recommendations.push({
        type: 'alert',
        title: 'Rapid Glucose Falling Rate',
        description: 'Your glucose falls at an average rate of ' + (getUserUnits() === 'mmol' ? fallingRate.toFixed(3) : fallingRate.toFixed(1)) + ' per minute. This may indicate over-insulinization or missed meals.'
      });
    } else if (fallingRate > fallingThreshold) {
      recommendations.push({
        type: 'warning',
        title: 'Moderate Glucose Falling Rate',
        description: 'Your glucose falls at an average rate of ' + (getUserUnits() === 'mmol' ? fallingRate.toFixed(3) : fallingRate.toFixed(1)) + ' per minute. Consider reducing insulin doses or adding snacks.'
      });
    }
  }
  
  // Significant change rate recommendations
  if (stats.significantRisingPercentage > 20) {
    recommendations.push({
      type: 'warning',
      title: 'Frequent Rapid Glucose Increases',
      description: Math.round(stats.significantRisingPercentage) + '% of your glucose increases were rapid (>=' + (getUserUnits() === 'mmol' ? stats.significantRisingThreshold.toFixed(1) : stats.significantRisingThreshold) + ' per minute). Consider adjusting your insulin timing.'
    });
  }
  
  if (stats.significantFallingPercentage > 15) {
    recommendations.push({
      type: 'alert',
      title: 'Frequent Rapid Glucose Decreases',
      description: Math.round(stats.significantFallingPercentage) + '% of your glucose decreases were rapid (>=' + (getUserUnits() === 'mmol' ? stats.significantFallingThreshold.toFixed(1) : stats.significantFallingThreshold) + ' per minute). This may indicate insulin stacking or missed meals.'
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
  $('#highReadings').text(stats.highCount + ' (' + Math.round((stats.highCount / stats.total) * 100) + '%), ' + stats.highTimeString);
  $('#lowReadings').text(stats.lowCount + ' (' + Math.round((stats.lowCount / stats.total) * 100) + '%), ' + stats.lowTimeString);
  
  // Display glucose change rates
  var risingRateDisplay = '--';
  var fallingRateDisplay = '--';
  
  if (stats.risingRateStats && stats.risingRateStats.count > 0) {
    risingRateDisplay = units === 'mmol' ? 
      stats.risingRateStats.mean.toFixed(3) + ' mmol/L/min' : 
      stats.risingRateStats.mean.toFixed(1) + ' mg/dL/min';
  }
  
  if (stats.fallingRateStats && stats.fallingRateStats.count > 0) {
    fallingRateDisplay = units === 'mmol' ? 
      stats.fallingRateStats.mean.toFixed(3) + ' mmol/L/min' : 
      stats.fallingRateStats.mean.toFixed(1) + ' mg/dL/min';
  }
  
  $('#risingRate').text(risingRateDisplay);
  $('#fallingRate').text(fallingRateDisplay);
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
  
  // Weekly graph with daily averages and standard deviations
  createWeeklyGraph(data, targetLow, targetHigh);
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
  var hourlyHighCounts = {};
  var hourlyLowCounts = {};
  
  for (var i = 0; i < 24; i++) {
    hourlyAverages[i] = 0;
    hourlyCounts[i] = 0;
    hourlyHighCounts[i] = 0;
    hourlyLowCounts[i] = 0;
  }
  
  data.forEach(function(entry) {
    var hour = entry.date.getHours();
    hourlyAverages[hour] += entry.sgv;
    hourlyCounts[hour]++;
    
    // Convert to user's preferred units for comparison
    var convertedValue = units === 'mmol' ? entry.sgv / 18 : entry.sgv;
    
    // Count high and low readings
    if (convertedValue >= targetHigh) {
      hourlyHighCounts[hour]++;
    } else if (convertedValue < targetLow) {
      hourlyLowCounts[hour]++;
    }
  });
  
  // Calculate averages and prepare chart data
  var chartData = [];
  for (var i = 0; i < 24; i++) {
    if (hourlyCounts[i] > 0) {
      chartData.push({
        hour: i,
        average: hourlyAverages[i] / hourlyCounts[i],
        count: hourlyCounts[i],
        highCount: hourlyHighCounts[i],
        lowCount: hourlyLowCounts[i]
      });
    }
  }
  
  // Find the 3 hours with the most high readings
  var highReadingHours = chartData.slice().sort(function(a, b) {
    return b.highCount - a.highCount;
  }).slice(0, 3).map(function(item) { return item.hour; });
  
  // Find the 3 hours with the most low readings
  var lowReadingHours = chartData.slice().sort(function(a, b) {
    return b.lowCount - a.lowCount;
  }).slice(0, 3).map(function(item) { return item.hour; });
  
  console.log('Hours with most high readings:', highReadingHours);
  console.log('Hours with most low readings:', lowReadingHours);
  
  // Simple chart using HTML/CSS
  var container = $('#hourlyChart');
  container.empty();
  
  var table = $('<table style="width: 100%; border-collapse: collapse;"></table>');
  var header = $('<tr><th style="padding: 8px; border: 1px solid #ddd;">Hour</th><th style="padding: 8px; border: 1px solid #ddd;">Average</th><th style="padding: 8px; border: 1px solid #ddd;">Readings</th><th style="padding: 8px; border: 1px solid #ddd;">High</th><th style="padding: 8px; border: 1px solid #ddd;">Low</th></tr>');
  table.append(header);
  
  chartData.forEach(function(hour) {
    var row = $('<tr></tr>');
    
    // Determine row highlighting
    var isHighHighlight = highReadingHours.includes(hour.hour);
    var isLowHighlight = lowReadingHours.includes(hour.hour);
    
    var rowStyle = '';
    if (isHighHighlight && isLowHighlight) {
      // Both high and low - use a special color
      rowStyle = 'background-color: #ffeb3b; font-weight: bold;';
    } else if (isHighHighlight) {
      // High readings - use red background
      rowStyle = 'background-color: #ffcdd2; font-weight: bold;';
    } else if (isLowHighlight) {
      // Low readings - use blue background
      rowStyle = 'background-color: #bbdefb; font-weight: bold;';
    }
    
    if (rowStyle) {
      row.attr('style', rowStyle);
    }
    
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + hour.hour + ':00</td>');
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + convertToUserUnits(hour.average, units) + '</td>');
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + hour.count + '</td>');
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + hour.highCount + '</td>');
    row.append('<td style="padding: 8px; border: 1px solid #ddd;">' + hour.lowCount + '</td>');
    table.append(row);
  });
  
  container.append(table);
  
  // Add legend
  var legend = $('<div style="margin-top: 15px; font-size: 0.9em; color: #666;"></div>');
  legend.append('<div style="margin-bottom: 5px;"><span style="background-color: #ffcdd2; padding: 2px 6px; margin-right: 5px;">■</span> Top 3 hours with most high readings</div>');
  legend.append('<div style="margin-bottom: 5px;"><span style="background-color: #bbdefb; padding: 2px 6px; margin-right: 5px;">■</span> Top 3 hours with most low readings</div>');
  legend.append('<div><span style="background-color: #ffeb3b; padding: 2px 6px; margin-right: 5px;">■</span> Hours with both high and low readings</div>');
  container.append(legend);
}

function createWeeklyGraph(data, targetLow, targetHigh) {
  // Get user's preferred units from client settings
  var units = getUserUnits();
  
  // Group data by day of week
  var dailyData = {};
  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Initialize daily data structure
  for (var i = 0; i < 7; i++) {
    dailyData[i] = [];
  }
  
  // Group glucose values by day of week
  data.forEach(function(entry) {
    var day = entry.date.getDay();
    dailyData[day].push(entry.sgv);
  });
  
  // Calculate daily statistics
  var chartData = [];
  for (var i = 0; i < 7; i++) {
    if (dailyData[i].length > 0) {
      // Convert to user's preferred units
      var convertedValues = dailyData[i].map(function(value) {
        if (units === 'mmol') {
          return value / 18; // Convert mg/dL to mmol/L
        } else {
          return value; // Keep as mg/dL
        }
      });
      
      // Calculate average
      var sum = convertedValues.reduce(function(a, b) { return a + b; }, 0);
      var average = sum / convertedValues.length;
      
      // Calculate standard deviation
      var variance = convertedValues.reduce(function(acc, val) {
        return acc + Math.pow(val - average, 2);
      }, 0) / convertedValues.length;
      var stdDev = Math.sqrt(variance);
      
      chartData.push({
        day: dayNames[i],
        dayIndex: i,
        average: average,
        stdDev: stdDev,
        count: convertedValues.length
      });
    }
  }
  
  // Create the graph container
  var container = $('#weeklyGraph');
  container.empty();
  
  // Add chart title
  container.append('<h3>Daily Glucose Trends</h3>');
  container.append('<p style="color: #666; margin-bottom: 20px;">Average and standard deviation for each day of the week</p>');
  
  // Create canvas for the chart
  var canvas = $('<canvas id="weeklyChartCanvas" width="800" height="400"></canvas>');
  container.append(canvas);
  
  // Create the chart using Chart.js (if available) or fallback to HTML table
  if (typeof Chart !== 'undefined') {
    createChartJSGraph(chartData, units, targetLow, targetHigh);
  } else {
    createHTMLTableGraph(chartData, units, targetLow, targetHigh);
  }
}

function createChartJSGraph(chartData, units, targetLow, targetHigh) {
  var ctx = document.getElementById('weeklyChartCanvas').getContext('2d');
  
  var labels = chartData.map(function(d) { return d.day; });
  var averages = chartData.map(function(d) { return d.average; });
  var stdDevs = chartData.map(function(d) { return d.stdDev; });
  
  // Calculate upper and lower bounds for standard deviation bands
  var upperBounds = averages.map(function(avg, i) { return avg + stdDevs[i]; });
  var lowerBounds = averages.map(function(avg, i) { return avg - stdDevs[i]; });
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Daily Average',
          data: averages,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.1
        },
        {
          label: 'Upper Bound (Avg + SD)',
          data: upperBounds,
          borderColor: 'rgba(102, 126, 234, 0.3)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 1,
          fill: false,
          tension: 0.1
        },
        {
          label: 'Lower Bound (Avg - SD)',
          data: lowerBounds,
          borderColor: 'rgba(102, 126, 234, 0.3)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 1,
          fill: false,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'Glucose (' + (units === 'mmol' ? 'mmol/L' : 'mg/dL') + ')'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Day of Week'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              label += context.parsed.y.toFixed(1) + ' ' + (units === 'mmol' ? 'mmol/L' : 'mg/dL');
              return label;
            }
          }
        }
      }
    }
  });
}

function createHTMLTableGraph(chartData, units, targetLow, targetHigh) {
  // Fallback to HTML table if Chart.js is not available
  var container = $('#weeklyGraph');
  container.find('canvas').remove();
  
  var table = $('<table style="width: 100%; border-collapse: collapse; margin-top: 20px;"></table>');
  var header = $('<tr><th style="padding: 12px; border: 1px solid #ddd; background-color: #f8f9fa;">Day</th><th style="padding: 12px; border: 1px solid #ddd; background-color: #f8f9fa;">Average</th><th style="padding: 12px; border: 1px solid #ddd; background-color: #f8f9fa;">Std Dev</th><th style="padding: 12px; border: 1px solid #ddd; background-color: #f8f9fa;">Range</th><th style="padding: 12px; border: 1px solid #ddd; background-color: #f8f9fa;">Readings</th></tr>');
  table.append(header);
  
  chartData.forEach(function(day) {
    var row = $('<tr></tr>');
    var rangeText = (day.average - day.stdDev).toFixed(1) + ' - ' + (day.average + day.stdDev).toFixed(1);
    
    row.append('<td style="padding: 12px; border: 1px solid #ddd;">' + day.day + '</td>');
    row.append('<td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">' + day.average.toFixed(1) + '</td>');
    row.append('<td style="padding: 12px; border: 1px solid #ddd;">' + day.stdDev.toFixed(1) + '</td>');
    row.append('<td style="padding: 12px; border: 1px solid #ddd;">' + rangeText + '</td>');
    row.append('<td style="padding: 12px; border: 1px solid #ddd;">' + day.count + '</td>');
    
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