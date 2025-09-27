#!/usr/bin/env node

/**
 * Security Update Script for Nightscout CGM Monitor
 * 
 * This script helps update vulnerable dependencies and provides
 * recommendations for security improvements.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔒 Nightscout Security Update Script');
console.log('=====================================\n');

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('📋 Current Security Status:');
console.log('----------------------------');

// Run npm audit and capture output
try {
  const auditOutput = execSync('npm audit --json', { 
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  
  const auditData = JSON.parse(auditOutput);
  const vulnerabilities = auditData.vulnerabilities || {};
  
  const severityCounts = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0
  };
  
  Object.values(vulnerabilities).forEach(vuln => {
    if (severityCounts.hasOwnProperty(vuln.severity)) {
      severityCounts[vuln.severity]++;
    }
  });
  
  console.log(`Critical: ${severityCounts.critical}`);
  console.log(`High: ${severityCounts.high}`);
  console.log(`Moderate: ${severityCounts.moderate}`);
  console.log(`Low: ${severityCounts.low}`);
  console.log(`Total: ${Object.values(severityCounts).reduce((a, b) => a + b, 0)}\n`);
  
} catch (error) {
  console.log('❌ Could not run npm audit');
}

// Recommended updates
console.log('🔧 Recommended Security Updates:');
console.log('----------------------------------');

const recommendations = [
  {
    package: 'axios',
    current: '^0.21.1',
    recommended: '^1.12.2',
    reason: 'Fix CSRF, SSRF, and DoS vulnerabilities',
    priority: 'high'
  },
  {
    package: 'express',
    current: '4.17.1',
    recommended: '^4.21.2',
    reason: 'Fix multiple security vulnerabilities',
    priority: 'high'
  },
  {
    package: 'socket.io',
    current: '~4.5.4',
    recommended: '^4.8.1',
    reason: 'Fix WebSocket security issues',
    priority: 'medium'
  },
  {
    package: 'dompurify',
    current: '^2.2.6',
    recommended: '^3.2.7',
    reason: 'Fix XSS and prototype pollution',
    priority: 'high'
  },
  {
    package: 'd3',
    current: '^5.16.0',
    recommended: '^7.9.0',
    reason: 'Fix ReDoS vulnerabilities',
    priority: 'medium'
  }
];

recommendations.forEach(rec => {
  const priorityEmoji = rec.priority === 'high' ? '🔴' : 
                       rec.priority === 'medium' ? '🟡' : '🟢';
  console.log(`${priorityEmoji} ${rec.package}`);
  console.log(`   Current: ${rec.current}`);
  console.log(`   Recommended: ${rec.recommended}`);
  console.log(`   Reason: ${rec.reason}\n`);
});

// Package replacement recommendations
console.log('🔄 Package Replacement Recommendations:');
console.log('---------------------------------------');

const replacements = [
  {
    current: 'request',
    replacement: 'axios',
    reason: 'request package is deprecated and has security issues'
  },
  {
    current: 'form-data',
    replacement: 'formidable',
    reason: 'form-data has critical security vulnerabilities'
  },
  {
    current: 'tough-cookie',
    replacement: 'js-cookie',
    reason: 'tough-cookie has prototype pollution issues'
  }
];

replacements.forEach(rep => {
  console.log(`📦 Replace ${rep.current} with ${rep.replacement}`);
  console.log(`   Reason: ${rep.reason}\n`);
});

// Security best practices
console.log('🛡️ Security Best Practices:');
console.log('---------------------------');

const practices = [
  'Enable Content Security Policy (CSP) headers',
  'Implement rate limiting middleware',
  'Add security headers (helmet.js)',
  'Use environment variables for sensitive data',
  'Implement proper input validation',
  'Add request logging and monitoring',
  'Enable HTTPS in production',
  'Regular security audits (monthly)',
  'Keep dependencies updated',
  'Use automated vulnerability scanning'
];

practices.forEach((practice, index) => {
  console.log(`${index + 1}. ${practice}`);
});

console.log('\n📝 Next Steps:');
console.log('---------------');
console.log('1. Review the SECURITY_AUDIT_REPORT.md for detailed analysis');
console.log('2. Update high-priority packages first');
console.log('3. Test thoroughly after each update');
console.log('4. Consider replacing deprecated packages');
console.log('5. Implement security best practices');
console.log('6. Set up automated security scanning');

console.log('\n✅ Security update script completed!');
