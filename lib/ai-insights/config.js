'use strict';

/**
 * AI Insights Configuration
 * Environment variables and settings for LLM integration
 */

function create(env) {
  const config = {
    // OpenAI Configuration
    openai: {
      apiKey: env.AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      model: env.AI_OPENAI_MODEL || 'gpt-3.5-turbo',
      maxTokens: env.AI_OPENAI_MAX_TOKENS || 2000,
      temperature: env.AI_OPENAI_TEMPERATURE || 0.7
    },
    
    // Anthropic Configuration
    anthropic: {
      apiKey: env.AI_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
      model: env.AI_ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      maxTokens: env.AI_ANTHROPIC_MAX_TOKENS || 2000
    },
    
    // General AI Settings
    enabled: env.AI_INSIGHTS_ENABLED !== 'false',
    fallbackToRules: env.AI_FALLBACK_TO_RULES !== 'false',
    cacheEnabled: env.AI_CACHE_ENABLED !== 'false',
    cacheTTL: env.AI_CACHE_TTL || 3600, // 1 hour in seconds
    
    // Rate Limiting
    rateLimiting: {
      enabled: env.AI_RATE_LIMITING_ENABLED !== 'false',
      maxRequestsPerHour: env.AI_MAX_REQUESTS_PER_HOUR || 20,
      maxRequestsPerDay: env.AI_MAX_REQUESTS_PER_DAY || 100
    },
    
    // Request Configuration
    request: {
      timeout: env.AI_REQUEST_TIMEOUT || 30000, // 30 seconds
      retryAttempts: env.AI_RETRY_ATTEMPTS || 3,
      retryDelay: env.AI_RETRY_DELAY || 1000 // 1 second
    },
    
    // Data Processing
    dataProcessing: {
      maxDataPoints: env.AI_MAX_DATA_POINTS || 1000,
      minDataPoints: env.AI_MIN_DATA_POINTS || 50,
      includeTreatments: env.AI_INCLUDE_TREATMENTS !== 'false',
      includeDeviceStatus: env.AI_INCLUDE_DEVICE_STATUS !== 'false'
    },
    
    // Output Configuration
    output: {
      maxRecommendations: env.AI_MAX_RECOMMENDATIONS || 10,
      includeConfidenceScores: env.AI_INCLUDE_CONFIDENCE_SCORES !== 'false',
      includeMetadata: env.AI_INCLUDE_METADATA !== 'false'
    }
  };

  // Validation
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.warn('AI Insights configuration validation failed:', validation.errors);
  }

  return config;
}

function validateConfig(config) {
  const errors = [];
  
  // Check if any LLM provider is configured
  if (!config.openai.apiKey && !config.anthropic.apiKey) {
    errors.push('No LLM API key configured. Set AI_OPENAI_API_KEY or AI_ANTHROPIC_API_KEY.');
  }
  
  // Validate rate limiting
  if (config.rateLimiting.maxRequestsPerHour > 100) {
    errors.push('AI_MAX_REQUESTS_PER_HOUR should not exceed 100 to avoid rate limiting.');
  }
  
  // Validate data processing limits
  if (config.dataProcessing.minDataPoints > config.dataProcessing.maxDataPoints) {
    errors.push('AI_MIN_DATA_POINTS cannot be greater than AI_MAX_DATA_POINTS.');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

module.exports = create;
