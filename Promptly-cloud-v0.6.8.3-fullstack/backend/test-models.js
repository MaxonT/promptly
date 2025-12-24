import 'dotenv/config';
import { chatText, chatJson } from './src/lib/llmRouter.js';
import { MODE_POLICIES, getModePolicy } from './src/lib/modePolicies.js';

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function logHeader(msg) { console.log(`\n${colors.cyan}=== ${msg} ===${colors.reset}`); }
function logPass(msg) { console.log(`${colors.green}✓ PASS${colors.reset}: ${msg}`); }
function logFail(msg) { console.log(`${colors.red}✗ FAIL${colors.reset}: ${msg}`); }
function logInfo(msg) { console.log(`${colors.yellow}ℹ INFO${colors.reset}: ${msg}`); }

async function runTests() {
    console.log("Starting System Verification...");
    
    // 1. Verify Mode Policies
    logHeader("1. Verifying Mode Policies");
    try {
        const fast = getModePolicy('fast');
        const standard = getModePolicy('standard');
        
        if (fast.specBuilder.provider === 'groq' && fast.questionEngine.enabled === false) {
            logPass("FAST mode policy is correct (Groq-only, No QE)");
        } else {
            logFail("FAST mode policy mismatch");
        }
        
        if (standard.specBuilder.provider === 'openai' && standard.questionEngine.enabled === true) {
            logPass("STANDARD mode policy is correct (OpenAI Spec, QE Enabled)");
        } else {
            logFail("STANDARD mode policy mismatch");
        }
    } catch (e) {
        logFail(`Policy check failed: ${e.message}`);
    }

    // 2. Check Environment Variables
    logHeader("2. Checking API Keys");
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGroq = !!process.env.GROQ_API_KEY;
    
    if (hasOpenAI) logPass("OPENAI_API_KEY found"); else logInfo("OPENAI_API_KEY missing (skipping real calls)");
    if (hasGroq) logPass("GROQ_API_KEY found"); else logInfo("GROQ_API_KEY missing (skipping real calls)");

    // 3. Test OpenAI Call (if key exists)
    if (hasOpenAI) {
        logHeader("3. Testing OpenAI Integration (via Router)");
        try {
            logInfo("Sending chatText request to OpenAI...");
            const res = await chatText({
                system: "You are a test bot.",
                user: "Reply with 'pong'",
                model: "gpt-4o-mini",
                provider: "openai"
            });
            if (res.text) {
                logPass(`OpenAI Response: "${res.text.trim()}"`);
            } else {
                logFail("OpenAI returned empty response");
            }
        } catch (e) {
            logFail(`OpenAI Call Failed: ${e.message}`);
        }
    }

    // 4. Test Groq Call (if key exists)
    if (hasGroq) {
        logHeader("4. Testing Groq Integration (via Router)");
        try {
            logInfo("Sending chatJson request to Groq...");
            const res = await chatJson({
                system: "You are a JSON bot. Output { \"status\": \"ok\" }",
                user: "Go",
                model: "llama-3.1-8b-instant",
                provider: "groq"
            });
            if (res.data && res.data.status === 'ok') {
                logPass(`Groq JSON Response: ${JSON.stringify(res.data)}`);
            } else {
                logFail(`Groq returned unexpected JSON: ${JSON.stringify(res.data)}`);
            }
        } catch (e) {
            logFail(`Groq Call Failed: ${e.message}`);
        }
    }
    
    console.log("\nVerification Complete.");
}

runTests();
