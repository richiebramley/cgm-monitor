# Weekly Summary Feature

## Overview

The Weekly Summary feature provides a comprehensive analysis of your diabetes data for any given week (Monday to Sunday). It displays key statistics, generates personalized recommendations, and shows trends to help you better manage your diabetes.

## Features

### Key Statistics
- **Time in Range**: Percentage of readings within your target glucose range
- **Average Glucose**: Mean glucose level for the week
- **Standard Deviation**: Measure of glucose variability
- **Total Readings**: Number of glucose readings available
- **High Readings**: Count and percentage of readings above target range
- **Low Readings**: Count and percentage of readings below target range

### Smart Recommendations
The system analyzes your data and provides personalized recommendations based on:

- **Time in Range Performance**: Suggestions for improving glucose control
- **High/Low Reading Patterns**: Recommendations for insulin dosing adjustments
- **Glucose Variability**: Advice on meal timing and insulin consistency
- **Data Completeness**: Alerts for missing or incomplete data
- **Average Glucose Trends**: Basal rate and bolus recommendations
- **Trend Analysis**: Detection of upward or downward glucose trends

### Visual Data
- **Daily Trends**: Average glucose by day of the week
- **Hourly Distribution**: Glucose patterns throughout the day

## How to Access

1. Navigate to the main Nightscout interface
2. Click on the menu (hamburger icon) in the top left
3. Select "Weekly Summary" from the navigation menu
4. The page will load with the current week's data

## Navigation

- **Previous Week**: View data from the previous Monday-Sunday period
- **Current Week**: Return to the current week (default view)
- **Next Week**: View data from the next Monday-Sunday period

## Data Requirements

- Requires CGM data (SGV entries) for the selected week
- Minimum of 10 readings recommended for meaningful analysis
- Data should be uploaded to Nightscout within the selected time period

## Recommendations Logic

### Time in Range
- **Excellent**: ≥80% - Green recommendation
- **Moderate**: 70-79% - Yellow warning
- **Low**: <70% - Red alert

### High Readings
- Alert triggered when >30% of readings are above target range

### Low Readings
- Alert triggered when >10% of readings are below target range

### Variability
- Warning when standard deviation >30% of target high

### Data Completeness
- Warning when <80% of expected readings are available

### Trend Analysis
- Detects significant upward or downward trends (>10% change)
- Uses moving average analysis for trend detection

## Technical Details

### Files Added/Modified
- `views/weeklysummary.html` - Main page template
- `static/js/weeklysummary.js` - JavaScript functionality
- `lib/server/app.js` - Added route for weekly summary
- `views/index.html` - Added navigation link
- `translations/en/en.json` - Added translation

### API Endpoints Used
- `/api/v1/entries.json` - Retrieves glucose data for analysis

### Browser Compatibility
- Modern browsers with JavaScript enabled
- Responsive design for mobile and desktop

## Future Enhancements

Potential improvements for future versions:
- Integration with insulin and carb data
- More sophisticated trend analysis
- Export functionality for reports
- Comparison with previous weeks
- Goal setting and tracking
- Integration with treatment data

## Support

For issues or questions about the Weekly Summary feature:
1. Check that your CGM data is properly uploaded
2. Verify your target glucose ranges are set correctly
3. Ensure you have sufficient data for the selected week
4. Check browser console for any JavaScript errors 