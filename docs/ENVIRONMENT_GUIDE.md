# 🔧 Environment Configuration Guide for Agents

> **This guide is specifically designed for AI agents working on the DataCollector project**

## 🚨 Security First - What Agents Can and Cannot Do

### ❌ **FORBIDDEN ACTIONS**
- **DO NOT** read `.env` files directly using `read_file` tool
- **DO NOT** modify `.env` files or API keys
- **DO NOT** access environment files for security reasons
- **DO NOT** hardcode sensitive values in code

### ✅ **SAFE ALTERNATIVES**
- **USE** the environment configuration module: `./config/environment`
- **USE** environment validation script: `npm run check:env`
- **USE** system environment variables and fallbacks
- **USE** the provided debugging functions

## 🛠️ How to Work with Environment Variables

### 1. **In Backend Code - Use the Configuration Module**

```typescript
// ✅ CORRECT - Import and use the environment module
import { ENV_CONFIG, ENV_STATUS, getEnvironmentInfo } from './config/environment';

// ✅ SAFE - Access configuration values
const port = ENV_CONFIG.PORT;                    // number: 3001
const dbUrl = ENV_CONFIG.DATABASE_URL;           // string: full connection URL
const openaiKey = ENV_CONFIG.OPENAI_API_KEY;    // string: API key or empty
const nodeEnv = ENV_CONFIG.NODE_ENV;             // string: 'development'

// ✅ SAFE - Check environment health
import { getEnvironmentHealth } from './config/environment';
const health = getEnvironmentHealth();
console.log('Environment status:', health.status); // 'healthy' | 'warning' | 'error'
```

### 2. **Check Environment Status**

```typescript
// ✅ SAFE - Get environment information
import { getEnvironmentInfo } from './config/environment';

const envInfo = getEnvironmentInfo();
console.log('Has OpenAI key:', envInfo.hasOpenAIKey);        // boolean
console.log('Environment:', envInfo.nodeEnv);               // string
console.log('Services configured:', envInfo.servicesConfigured); // object
```

### 3. **Validate Environment Setup**

```bash
# ✅ SAFE - Run environment validation
npm run check:env

# ✅ SAFE - Test infrastructure services
npm run test:infrastructure

# ✅ SAFE - Start development with environment
npm run dev:backend
```

## 🔍 Understanding Environment Check Results

### **Expected Output When Environment is Properly Configured:**

```
✅ Environment file (.env): OK
   Found at: C:\Users\tomasz\Documents\Programowanie lapek\DataCollector\.env

✅ OpenAI API access: OK
   OPENAI_API_KEY=sk-...

✅ Environment mode: OK
   NODE_ENV=development
```

### **Expected Output When Using Fallbacks (Normal for Agents):**

```
⚠️ No .env file found in expected locations
   This is OK for agents - they can use system environment variables

⚠️ Environment mode: FALLBACK
   Using default: development

🟡 Environment Setup: WARNING
   Some issues detected
```

**This is NORMAL and OK** - The system will work with fallback values.

### **Critical Issues That Need Attention:**

```
❌ OpenAI API access: MISSING
   OPENAI_API_KEY not set

🔴 Environment Setup: ERROR
   Critical issues need attention
```

**When you see this:** The system needs the OpenAI API key to function properly.

## 🚦 Environment Health Status Guide

| Status | Meaning | Action for Agents |
|--------|---------|-------------------|
| 🟢 **Healthy** | All required variables present | ✅ Proceed with development |
| 🟡 **Warning** | Using fallbacks, non-critical missing | ✅ OK to continue, inform user |
| 🔴 **Error** | Critical variables missing (OPENAI_API_KEY) | ⚠️ Limited functionality, inform user |

## 🔧 Troubleshooting Common Issues

### **Issue: "No .env file found"**
```
⚠️ No .env file found in any expected location
🔄 Continuing with environment variables from system and defaults...
```

**Agent Response:** This is normal. The system will use fallback values and continue working.

### **Issue: "Missing required environment variables"**
```
CRITICAL: Missing required environment variables: OPENAI_API_KEY
```

**Agent Response:** 
1. Run `npm run check:env` to see full status
2. Inform user that OpenAI features may not work
3. Continue with other features that don't require OpenAI

### **Issue: "Could not access .env file"**
```
⚠️ Could not access .env file at [path]: [error]
```

**Agent Response:** This is expected for agents. The system handles this gracefully.

## 📋 Development Workflow for Agents

### **1. Before Starting Development**
```bash
# Check environment status
npm run check:env

# Verify infrastructure is running  
npm run test:infrastructure
```

### **2. During Development**
```typescript
// In backend code - always use the environment module
import { ENV_CONFIG } from './config/environment';

// Don't use process.env directly in new code
const port = ENV_CONFIG.PORT; // ✅ GOOD
const port = process.env.PORT || 3001; // ❌ AVOID
```

### **3. When Adding New Environment Variables**
1. **ADD** the variable to the `EnvironmentConfig` interface in `./config/environment.ts`
2. **ADD** a fallback value to `DEFAULT_CONFIG` (if appropriate)
3. **UPDATE** the environment loading logic
4. **TEST** with `npm run check:env`

### **4. Testing Environment Changes**
```bash
# Test environment loading
npm run check:env

# Test backend startup
npm run dev:backend

# Test infrastructure connectivity
npm run test:infrastructure
```

## 📚 Environment Variables Reference

### **Critical Variables (Required)**
- `OPENAI_API_KEY` - Required for AI features

### **Infrastructure Variables (Have Fallbacks)**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection  
- `OPENSEARCH_URL` - OpenSearch service
- `CHROMADB_URL` - ChromaDB service

### **Application Variables (Have Fallbacks)**
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (3001)
- `FRONTEND_URL` - Frontend URL (http://localhost:3000)

### **Security Variables (Required in Production)**
- `JWT_SECRET` - Token signing (has development fallback)

## 🎯 Best Practices for Agents

### **✅ DO**
- Use the environment configuration module for all environment access
- Run `npm run check:env` when troubleshooting
- Handle missing environment gracefully in your code
- Use fallback values appropriately
- Test environment setup before major development work

### **❌ DON'T**
- Try to read .env files directly
- Hardcode environment values
- Assume all environment variables are always present
- Skip environment validation when issues arise
- Modify or suggest modifying .env files

## 🔗 Related Files

- `packages/backend/src/config/environment.ts` - Environment configuration module
- `scripts/check-environment.js` - Environment validation script
- `env.example` - Environment variable template
- `CURSOR_AGENTS_CONTEXT.md` - Main agent guidelines

---

**Remember**: This environment system is designed to work safely with agents while maintaining security. When in doubt, use the provided modules and scripts rather than trying to access environment files directly. 