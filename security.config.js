/**
 * Security Configuration for Nightscout CGM Monitor
 * 
 * This file contains security-related configurations and middleware
 * to enhance the security posture of the application.
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Rate limiting configuration
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: {
    error: 'Too many requests',
    message: message || 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/status' || req.path === '/ping';
  }
});

// API rate limiting
const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many API requests from this IP, please try again later.'
);

// Auth rate limiting (stricter for login attempts)
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 login attempts per windowMs
  'Too many authentication attempts from this IP, please try again later.'
);

// Upload rate limiting
const uploadRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  10, // limit each IP to 10 uploads per minute
  'Too many uploads from this IP, please try again later.'
);

// Security middleware configuration
const securityConfig = {
  // CORS configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:1337'],
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Session security
  session: {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    }
  },

  // Input validation
  validation: {
    maxRequestSize: '10mb',
    maxFileSize: '5mb',
    allowedFileTypes: ['.json', '.csv', '.txt'],
    sanitizeInput: true
  },

  // Logging configuration
  logging: {
    logSecurityEvents: true,
    logFailedAttempts: true,
    logSuspiciousActivity: true
  }
};

// Security event logging
const logSecurityEvent = (req, event, details = {}) => {
  if (!securityConfig.logging.logSecurityEvents) return;
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    event,
    details,
    path: req.path,
    method: req.method
  };
  
  console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
};

// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

// File upload validation
const validateFileUpload = (req, file, cb) => {
  const allowedTypes = securityConfig.validation.allowedFileTypes;
  const maxSize = securityConfig.validation.maxFileSize;
  
  // Check file type
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (!allowedTypes.includes(fileExtension)) {
    logSecurityEvent(req, 'INVALID_FILE_TYPE', { 
      fileName: file.originalname,
      fileType: fileExtension 
    });
    return cb(new Error('Invalid file type'), false);
  }
  
  // Check file size
  const fileSize = parseInt(maxSize) * 1024 * 1024; // Convert MB to bytes
  if (file.size > fileSize) {
    logSecurityEvent(req, 'FILE_TOO_LARGE', { 
      fileName: file.originalname,
      fileSize: file.size,
      maxSize: fileSize 
    });
    return cb(new Error('File too large'), false);
  }
  
  cb(null, true);
};

module.exports = {
  securityHeaders,
  apiRateLimit,
  authRateLimit,
  uploadRateLimit,
  securityConfig,
  logSecurityEvent,
  sanitizeInput,
  validateFileUpload
};
