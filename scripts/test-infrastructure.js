#!/usr/bin/env node

/**
 * DataCollector Infrastructure Test Script
 * 
 * This script tests all infrastructure services to ensure they're running correctly.
 * Run this after starting the Docker services with: npm run setup:infrastructure
 */

const http = require('http');
const https = require('https');

// Colors for console output
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

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

// Service configurations
const services = [
  {
    name: 'PostgreSQL',
    description: 'Database for job state management',
    host: 'localhost',
    port: 5432,
    type: 'tcp',
    icon: '🐘'
  },
  {
    name: 'Redis',
    description: 'Message queue and caching',
    host: 'localhost',
    port: 6379,
    type: 'tcp',
    icon: '🔴'
  },
  {
    name: 'OpenSearch',
    description: 'Full-text search engine',
    host: 'localhost',
    port: 9200,
    type: 'http',
    path: '/_cluster/health',
    icon: '🔍'
  },
  {
    name: 'OpenSearch Dashboards',
    description: 'Search management interface',
    host: 'localhost',
    port: 5601,
    type: 'http',
    path: '/api/status',
    icon: '📊'
  },
  {
    name: 'ChromaDB',
    description: 'Vector embeddings database',
    host: 'localhost',
    port: 8000,
    type: 'http',
    path: '/api/v1/heartbeat',
    icon: '🧠'
  },
  {
    name: 'PgAdmin',
    description: 'PostgreSQL management (optional)',
    host: 'localhost',
    port: 8080,
    type: 'http',
    path: '/misc/ping',
    icon: '🛠️',
    optional: true
  },
  {
    name: 'Redis Commander',
    description: 'Redis management (optional)',
    host: 'localhost',
    port: 8081,
    type: 'http',
    path: '/',
    icon: '⚡',
    optional: true
  }
];

// Test functions
function testTcpPort(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);
    
    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function testHttpEndpoint(host, port, path = '/', timeout = 10000) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: port,
      path: path,
      method: 'GET',
      timeout: timeout,
      headers: {
        'User-Agent': 'DataCollector-Infrastructure-Test'
      }
    };
    
    const req = http.request(options, (res) => {
      resolve({
        success: res.statusCode >= 200 && res.statusCode < 400,
        statusCode: res.statusCode,
        statusMessage: res.statusMessage
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });
    
    req.end();
  });
}

async function testService(service) {
  const startTime = Date.now();
  let result;
  
  try {
    if (service.type === 'tcp') {
      const isConnectable = await testTcpPort(service.host, service.port);
      result = {
        success: isConnectable,
        message: isConnectable ? 'Port is open and accepting connections' : 'Port is not accessible'
      };
    } else if (service.type === 'http') {
      result = await testHttpEndpoint(service.host, service.port, service.path);
      if (result.success) {
        result.message = `HTTP ${result.statusCode} ${result.statusMessage}`;
      } else {
        result.message = result.error || 'HTTP request failed';
      }
    }
  } catch (error) {
    result = {
      success: false,
      message: error.message
    };
  }
  
  const duration = Date.now() - startTime;
  return { ...result, duration };
}

async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🧪 DataCollector Infrastructure Test Suite', 'bright');
  log('='.repeat(60), 'cyan');
  
  log('\nTesting infrastructure services...\n', 'blue');
  
  const results = [];
  
  for (const service of services) {
    const serviceLabel = `${service.icon} ${service.name}`;
    process.stdout.write(colorize(`Testing ${serviceLabel.padEnd(25)} ... `, 'yellow'));
    
    const result = await testService(service);
    results.push({ service, result });
    
    if (result.success) {
      log(`✅ PASS (${result.duration}ms)`, 'green');
      if (result.message) {
        log(`   ${result.message}`, 'green');
      }
    } else {
      const status = service.optional ? '⚠️  SKIP' : '❌ FAIL';
      const color = service.optional ? 'yellow' : 'red';
      log(`${status} (${result.duration}ms)`, color);
      if (result.message) {
        log(`   ${result.message}`, color);
      }
    }
    
    if (service.description) {
      log(`   ${service.description}`, 'cyan');
    }
    log('');
  }
  
  // Summary
  const required = results.filter(r => !r.service.optional);
  const optional = results.filter(r => r.service.optional);
  const requiredPassed = required.filter(r => r.result.success).length;
  const optionalPassed = optional.filter(r => r.result.success).length;
  
  log('='.repeat(60), 'cyan');
  log('📋 Test Summary', 'bright');
  log('='.repeat(60), 'cyan');
  
  log(`\n📊 Required Services: ${requiredPassed}/${required.length} passing`, 
      requiredPassed === required.length ? 'green' : 'red');
  log(`📊 Optional Services: ${optionalPassed}/${optional.length} passing`, 
      optionalPassed === optional.length ? 'green' : 'yellow');
  
  if (requiredPassed === required.length) {
    log('\n🎉 All required services are running correctly!', 'green');
    log('✅ Infrastructure is ready for development', 'green');
    
    log('\n🔗 Service URLs:', 'blue');
    services.forEach(service => {
      if (service.type === 'http') {
        const url = `http://${service.host}:${service.port}`;
        log(`   ${service.icon} ${service.name}: ${url}`, 'cyan');
      }
    });
    
    log('\n🚀 Next steps:', 'blue');
    log('   1. Copy env.example to .env and configure your settings', 'cyan');
    log('   2. Add your OpenAI API key to the .env file', 'cyan');
    log('   3. Run: npm run dev:backend', 'cyan');
    log('   4. In another terminal: npm run dev:frontend', 'cyan');
    
  } else {
    log('\n❌ Some required services are not running', 'red');
    log('🔧 Please check the following:', 'yellow');
    log('   1. Docker Desktop is running', 'cyan');
    log('   2. Run: docker-compose -f infrastructure/docker/docker-compose.yml up -d', 'cyan');
    log('   3. Wait a few minutes for services to start', 'cyan');
    log('   4. Check Docker logs: docker-compose -f infrastructure/docker/docker-compose.yml logs', 'cyan');
  }
  
  // Failed services details
  const failed = results.filter(r => !r.result.success && !r.service.optional);
  if (failed.length > 0) {
    log('\n🚨 Failed Services:', 'red');
    failed.forEach(({ service, result }) => {
      log(`   ${service.icon} ${service.name}: ${result.message}`, 'red');
    });
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  process.exit(requiredPassed === required.length ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n\n⏹️  Test interrupted by user', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('\n\n⏹️  Test terminated', 'yellow');
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    log(`\n💥 Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { testService, runTests }; 