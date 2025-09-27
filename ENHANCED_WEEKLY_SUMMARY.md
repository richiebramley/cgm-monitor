# Enhanced Weekly Summary with AI Insights

## Overview

The Enhanced Weekly Summary is an advanced version of the existing weekly summary feature that incorporates AI-powered insights using Large Language Models (LLMs). This feature provides deeper analysis, personalized recommendations, and predictive insights to help users better understand and manage their diabetes.

## Features

### 🤖 AI-Powered Insights
- **Overall Assessment**: AI-generated score (1-10) with comprehensive analysis
- **Smart Recommendations**: Personalized, actionable recommendations based on glucose patterns
- **Pattern Recognition**: Advanced pattern detection beyond basic rule-based analysis
- **Predictive Analysis**: Risk factors, opportunities, and trend warnings
- **Personalized Tips**: Context-aware suggestions for improvement

### 📊 Enhanced Analytics
- **Advanced Statistics**: Comprehensive glucose metrics with variability scoring
- **Temporal Analysis**: Detailed hourly and daily pattern analysis
- **Change Rate Analysis**: Glucose rising and falling rate calculations
- **Data Quality Assessment**: Completeness and reliability scoring
- **Comparative Analysis**: Week-over-week trend analysis

### 📈 Improved Visualizations
- **Enhanced Charts**: More detailed hourly and daily distribution charts
- **Time Series Visualization**: Interactive glucose timeline
- **Distribution Analysis**: Glucose value distribution histograms
- **Trend Indicators**: Visual trend analysis with week-over-week comparisons

### 🔧 Advanced Features
- **Weekly Comparison**: Compare up to 12 weeks of data
- **Custom Insights**: Generate insights for custom date ranges
- **Toggle AI Features**: Enable/disable AI insights as needed
- **Fallback Support**: Automatic fallback to rule-based recommendations

## Configuration

### Environment Variables

#### Required for AI Features
```bash
# OpenAI Configuration
AI_OPENAI_API_KEY=your_openai_api_key_here
AI_OPENAI_MODEL=gpt-3.5-turbo  # or gpt-4

# Alternative: Anthropic Configuration
AI_ANTHROPIC_API_KEY=your_anthropic_api_key_here
AI_ANTHROPIC_MODEL=claude-3-haiku-20240307
```

#### Optional Configuration
```bash
# AI Feature Control
AI_INSIGHTS_ENABLED=true
AI_FALLBACK_TO_RULES=true
AI_CACHE_ENABLED=true
AI_CACHE_TTL=3600

# Rate Limiting
AI_MAX_REQUESTS_PER_HOUR=20
AI_MAX_REQUESTS_PER_DAY=100

# Request Configuration
AI_REQUEST_TIMEOUT=30000
AI_RETRY_ATTEMPTS=3

# Data Processing
AI_MAX_DATA_POINTS=1000
AI_MIN_DATA_POINTS=50
AI_INCLUDE_TREATMENTS=true
AI_INCLUDE_DEVICE_STATUS=false

# Output Configuration
AI_MAX_RECOMMENDATIONS=10
AI_INCLUDE_CONFIDENCE_SCORES=true
```

## API Endpoints

### GET /api/v1/weekly-summary
Get comprehensive weekly summary with AI insights.

**Parameters:**
- `weekStart` (optional): ISO date string for week start (defaults to current week)
- `includeTreatments` (optional): Include treatment data (default: true)
- `includeAIInsights` (optional): Include AI-powered insights (default: true)

**Response:**
```json
{
  "period": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-07T23:59:59.999Z",
    "weekNumber": 1
  },
  "statistics": {
    "total": 2016,
    "mean": 120.5,
    "stdDev": 25.3,
    "timeInRange": 75.2,
    "changeRates": { ... }
  },
  "aiInsights": {
    "overallAssessment": {
      "score": 8,
      "summary": "Good glucose control with room for improvement",
      "keyStrengths": ["Consistent meal timing", "Good overnight control"],
      "keyChallenges": ["Post-meal spikes", "High variability"]
    },
    "priorityRecommendations": [
      {
        "priority": "high",
        "category": "insulin",
        "title": "Improve Pre-bolus Timing",
        "description": "Consider pre-bolusing 15 minutes before meals",
        "rationale": "Post-meal spikes suggest insufficient pre-bolus timing",
        "expectedImpact": "Reduced post-meal glucose spikes"
      }
    ],
    "predictiveInsights": {
      "riskFactors": ["High post-meal variability"],
      "opportunities": ["Optimize meal timing"],
      "trendWarnings": ["Monitor for pattern changes"]
    }
  },
  "metadata": {
    "generatedAt": "2024-01-08T10:30:00.000Z",
    "dataCompleteness": 0.95,
    "processingTime": 1250
  }
}
```

### GET /api/v1/weekly-summary/compare
Compare current week with previous weeks.

**Parameters:**
- `weeks` (optional): Number of weeks to compare (default: 4, max: 12)
- `includeAIInsights` (optional): Include AI insights in comparison (default: true)

### POST /api/v1/weekly-summary/insights
Generate custom insights for a specific period.

**Body:**
```json
{
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-07T23:59:59.999Z",
  "focusAreas": ["glucose", "treatments", "patterns"],
  "includePredictions": true
}
```

## Usage

### Accessing Enhanced Weekly Summary

1. **Via Web Interface:**
   - Navigate to `/weeklysummary-enhanced` in your Nightscout instance
   - Use the week selector to navigate between weeks
   - Toggle AI insights on/off as needed
   - Click "Weekly Comparison" to view trend analysis

2. **Via API:**
   ```javascript
   // Get current week summary
   const response = await fetch('/api/v1/weekly-summary', {
     headers: { 'Authorization': 'Bearer your_token' }
   });
   const data = await response.json();
   ```

### Understanding AI Insights

#### Overall Assessment Score
- **9-10**: Excellent glucose control
- **7-8**: Good control with minor areas for improvement
- **5-6**: Moderate control requiring attention
- **3-4**: Poor control needing significant intervention
- **1-2**: Critical control issues requiring immediate attention

#### Recommendation Priorities
- **High**: Critical issues requiring immediate attention
- **Medium**: Important improvements that should be addressed
- **Low**: Optional optimizations for better control

#### Categories
- **Glucose Control**: Time in range, variability, target management
- **Insulin**: Dosing, timing, sensitivity
- **Meals**: Carb counting, timing, composition
- **Monitoring**: Data quality, alert settings
- **Lifestyle**: Exercise, stress, sleep patterns

## Privacy and Security

### Data Handling
- All data processing occurs on your server
- AI API calls include only aggregated, anonymized data
- No personal identifiers are sent to external services
- Responses are cached to minimize API calls

### API Key Security
- Store API keys in environment variables
- Use secure key management practices
- Monitor API usage and costs
- Implement rate limiting to prevent abuse

## Troubleshooting

### Common Issues

#### AI Insights Not Working
1. Check API key configuration
2. Verify environment variables are set
3. Check network connectivity to AI providers
4. Review server logs for error messages

#### High API Costs
1. Enable caching (`AI_CACHE_ENABLED=true`)
2. Reduce request frequency
3. Use smaller models (gpt-3.5-turbo vs gpt-4)
4. Implement stricter rate limiting

#### Poor AI Recommendations
1. Ensure sufficient data quality
2. Check target range settings
3. Verify treatment data is included
4. Consider adjusting AI model parameters

### Fallback Behavior
If AI insights fail:
1. System automatically falls back to rule-based recommendations
2. Basic statistics and charts remain available
3. Error messages are logged but don't break the interface
4. Users can disable AI features entirely if needed

## Performance Considerations

### Optimization Tips
- Enable caching for frequently accessed data
- Use appropriate data limits to avoid large API payloads
- Implement client-side caching for repeated requests
- Monitor API usage and costs

### Scalability
- Rate limiting prevents API abuse
- Caching reduces redundant API calls
- Async processing prevents UI blocking
- Fallback mechanisms ensure reliability

## Future Enhancements

### Planned Features
- Integration with treatment data for meal analysis
- Sleep and activity pattern correlation
- Seasonal trend analysis
- Goal setting and tracking
- Export functionality for reports
- Integration with other diabetes management tools

### Advanced AI Features
- Predictive modeling for glucose trends
- Personalized insulin dosing recommendations
- Meal timing optimization
- Risk prediction algorithms
- Integration with continuous learning models

## Support

### Getting Help
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify configuration and environment variables
4. Test with minimal data to isolate issues

### Contributing
- Report bugs and feature requests
- Contribute to AI prompt engineering
- Help improve data processing algorithms
- Suggest new insight categories

## License and Attribution

This enhanced weekly summary feature builds upon the existing Nightscout weekly summary functionality and adds AI-powered insights using various LLM providers. Please ensure compliance with the terms of service of your chosen AI provider.
