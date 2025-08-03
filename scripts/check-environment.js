#!/usr/bin/env node

/**
 * Environment Configuration Checker
 * 
 * This script validates the environment configuration for the DataCollector project.
 * It's safe for AI agents to use as it doesn't directly access or modify .env files.
 * 
 * Usage:
 *   node scripts/check-environment.js
 *   npm run check:env
 */

const path = require('path');
const fs = require('fs');

// ANSI color codes for output formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('='.repeat(60), 'cyan') + '\n');
}

function printStatus(label, status, details = '') {
  const statusColor = status === 'OK' ? 'green' : status === 'WARNING' ? 'yellow' : 'red';
  const statusIcon = status === 'OK' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
  
  console.log(`${statusIcon} ${colorize(label, 'bright')}: ${colorize(status, statusColor)}`);
  if (details) {
    console.log(`   ${colorize(details, 'blue')}`);
  }
}

function checkFileExists(filePath, description) {
  try {
    const exists = fs.existsSync(filePath);
    if (exists) {
      printStatus(description, 'OK', `Found at: ${filePath}`);
      return true;
    } else {
      printStatus(description, 'MISSING', `Not found at: ${filePath}`);
      return false;
    }
  } catch (error) {
    printStatus(description, 'ERROR', `Cannot access: ${error.message}`);
    return false;
  }
}

function checkEnvironmentFile() {
  printHeader('Environment File Check');
  
  const possiblePaths = [
    'C:\\Users\\tomasz\\Documents\\Programowanie lapek\\DataCollector\\.env',
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '../../.env')
  ];
  
  let foundEnvFile = false;
  
  for (const envPath of possiblePaths) {
    if (checkFileExists(envPath, `Environment file (${path.basename(envPath)})`)) {
      foundEnvFile = true;
      break;
    }
  }
  
  if (!foundEnvFile) {
    console.log(colorize('\n⚠️ No .env file found in expected locations', 'yellow'));
    console.log(colorize('This is OK for agents - they can use system environment variables', 'blue'));
  }
  
  return foundEnvFile;
}

function checkRequiredFiles() {
  printHeader('Required Files Check');
  
  const requiredFiles = [
    { path: 'env.example', description: 'Environment template' },
    { path: 'package.json', description: 'Root package.json' },
    { path: 'packages/backend/package.json', description: 'Backend package.json' },
    { path: 'packages/backend/src/config/environment.ts', description: 'Environment config module' },
    { path: 'packages/backend/src/app.ts', description: 'Backend application' }
  ];
  
  let allFilesPresent = true;
  
  for (const file of requiredFiles) {
    const exists = checkFileExists(file.path, file.description);
    if (!exists) {
      allFilesPresent = false;
    }
  }
  
  return allFilesPresent;
}

function checkEnvironmentVariables() {
  printHeader('Environment Variables Check');
  
  // Critical variables that must be present
  const criticalVars = [
    { name: 'OPENAI_API_KEY', description: 'OpenAI API access' },
  ];
  
  // Important variables with fallbacks
  const importantVars = [
    { name: 'NODE_ENV', description: 'Environment mode', fallback: 'development' },
    { name: 'PORT', description: 'Server port', fallback: '3001' },
    { name: 'DATABASE_URL', description: 'PostgreSQL connection', fallback: 'localhost default' },
    { name: 'REDIS_URL', description: 'Redis connection', fallback: 'localhost default' },
    { name: 'OPENSEARCH_URL', description: 'OpenSearch connection', fallback: 'localhost:9200' },
    { name: 'CHROMADB_URL', description: 'ChromaDB connection', fallback: 'localhost:8000' }
  ];
  
  let criticalMissing = 0;
  let usingFallbacks = 0;
  
  // Check critical variables
  console.log(colorize('Critical Variables:', 'bright'));
  for (const variable of criticalVars) {
    const value = process.env[variable.name];
    if (value) {
      const maskedValue = variable.name.includes('KEY') || variable.name.includes('SECRET') 
        ? `${value.substring(0, 8)}...` 
        : value;
      printStatus(variable.description, 'OK', `${variable.name}=${maskedValue}`);
    } else {
      printStatus(variable.description, 'MISSING', `${variable.name} not set`);
      criticalMissing++;
    }
  }
  
  // Check important variables
  console.log(colorize('\nImportant Variables:', 'bright'));
  for (const variable of importantVars) {
    const value = process.env[variable.name];
    if (value) {
      printStatus(variable.description, 'OK', `${variable.name}=${value}`);
    } else {
      printStatus(variable.description, 'FALLBACK', `Using default: ${variable.fallback}`);
      usingFallbacks++;
    }
  }
  
  return { criticalMissing, usingFallbacks };
}

function checkInfrastructureServices() {
  printHeader('Infrastructure Services Check');
  
  const services = [
    { name: 'PostgreSQL', port: 5432, url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/datacollector' },
    { name: 'Redis', port: 6379, url: process.env.REDIS_URL || 'redis://:redis123@localhost:6379' },
    { name: 'OpenSearch', port: 9200, url: process.env.OPENSEARCH_URL || 'http://localhost:9200' },
    { name: 'ChromaDB', port: 8000, url: process.env.CHROMADB_URL || 'http://localhost:8000' }
  ];
  
  console.log(colorize('📋 Service Configuration:', 'bright'));
  for (const service of services) {
    printStatus(service.name, 'CONFIGURED', `${service.url}`);
  }
  
  console.log(colorize('\n💡 To test service connectivity, run:', 'yellow'));
  console.log(colorize('   npm run test:infrastructure', 'blue'));
  
  return true;
}

function checkBackendConfiguration() {
  printHeader('Backend Configuration Check');
  
  try {
    // Try to load backend package.json
    const backendPackagePath = path.resolve(process.cwd(), 'packages/backend/package.json');
    if (fs.existsSync(backendPackagePath)) {
      const backendPackage = JSON.parse(fs.readFileSync(backendPackagePath, 'utf8'));
      
      // Check for required dependencies
      const requiredDeps = ['dotenv', 'express', 'winston', 'openai', 'redis', 'pg'];
      let missingDeps = 0;
      
      console.log(colorize('Required Dependencies:', 'bright'));
      for (const dep of requiredDeps) {
        if (backendPackage.dependencies && backendPackage.dependencies[dep]) {
          printStatus(dep, 'OK', `v${backendPackage.dependencies[dep]}`);
        } else {
          printStatus(dep, 'MISSING', 'Not found in dependencies');
          missingDeps++;
        }
      }
      
      // Check scripts
      const requiredScripts = ['dev', 'build', 'start'];
      console.log(colorize('\nRequired Scripts:', 'bright'));
      for (const script of requiredScripts) {
        if (backendPackage.scripts && backendPackage.scripts[script]) {
          printStatus(script, 'OK', backendPackage.scripts[script]);
        } else {
          printStatus(script, 'MISSING', 'Script not defined');
        }
      }
      
      return missingDeps === 0;
    } else {
      printStatus('Backend package.json', 'MISSING', 'Cannot verify dependencies');
      return false;
    }
  } catch (error) {
    printStatus('Backend configuration', 'ERROR', error.message);
    return false;
  }
}

function generateRecommendations(results) {
  printHeader('Recommendations');
  
  if (results.criticalMissing > 0) {
    console.log(colorize('🚨 CRITICAL ISSUES:', 'red'));
    console.log('   1. Set up missing critical environment variables');
    console.log('   2. Copy env.example to .env and fill in values');
    console.log('   3. Ensure OpenAI API key is properly configured');
  }
  
  if (results.usingFallbacks > 0) {
    console.log(colorize('\n⚠️ USING FALLBACKS:', 'yellow'));
    console.log('   1. Consider setting explicit values for better control');
    console.log('   2. Review env.example for recommended settings');
  }
  
  if (!results.envFileFound) {
    console.log(colorize('\n💡 AGENT-FRIENDLY SETUP:', 'blue'));
    console.log('   1. Environment module handles missing .env files gracefully');
    console.log('   2. Agents can work with system environment variables');
    console.log('   3. Critical variables should be set in system environment');
  }
  
  console.log(colorize('\n📚 USEFUL COMMANDS:', 'cyan'));
  console.log('   npm run test:infrastructure  # Test service connectivity');
  console.log('   npm run dev:backend          # Start backend development');
  console.log('   node scripts/check-environment.js  # Run this check again');
}

function main() {
  console.log(colorize('🔍 DataCollector Environment Configuration Checker', 'bright'));
  console.log(colorize('   Safe for AI agents - No direct .env file access', 'blue'));
  
  const results = {
    envFileFound: false,
    allFilesPresent: false,
    criticalMissing: 0,
    usingFallbacks: 0,
    infrastructureConfigured: false,
    backendConfigured: false
  };
  
  // Run all checks
  results.envFileFound = checkEnvironmentFile();
  results.allFilesPresent = checkRequiredFiles();
  
  const envVarResults = checkEnvironmentVariables();
  results.criticalMissing = envVarResults.criticalMissing;
  results.usingFallbacks = envVarResults.usingFallbacks;
  
  results.infrastructureConfigured = checkInfrastructureServices();
  results.backendConfigured = checkBackendConfiguration();
  
  // Generate recommendations
  generateRecommendations(results);
  
  // Overall status
  printHeader('Overall Status');
  
  if (results.criticalMissing === 0 && results.allFilesPresent) {
    printStatus('Environment Setup', 'OK', 'Ready for development');
  } else if (results.criticalMissing > 0) {
    printStatus('Environment Setup', 'ERROR', 'Critical issues need attention');
    process.exit(1);
  } else {
    printStatus('Environment Setup', 'WARNING', 'Some issues detected');
  }
  
  console.log('');
}

// Run the checker
if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironmentFile,
  checkRequiredFiles,
  checkEnvironmentVariables,
  checkInfrastructureServices,
  checkBackendConfiguration
}; 