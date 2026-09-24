import 'dotenv/config';
import { chatText, chatJson } from './src/lib/llmRouter.js';
import { PIPELINE_CONFIG, getStageModel, getStageList, shouldRunStage } from './src/lib/modelConfig.js';

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
    console.log("Starting System Verification (Pipeline v2)...");
    
    // 1. Verify Pipeline v2 Config
    logHeader("1. Verifying Pipeline v2 Config");
    try {
        const fastStages = getStageList('fast');
        const standardStages = getStageList('standard');
        const fastGen = getStageModel('fast', 'generation');
        const stdGen = getStageModel('standard', 'generation');
        
        if (fastGen.provider === 'groq' && !shouldRunStage('fast', 'critique')) {
            logPass("FAST mode: Groq provider, no critique (correct)");
        } else {
            logFail("FAST mode config mismatch");
        }
        
        if (stdGen.provider === 'groq' && shouldRunStage('standard', 'critique')) {
            logPass("STANDARD mode: Groq provider, critique enabled (correct)");
        } else {
            logFail("STANDARD mode config mismatch");
        }

        logInfo(`FAST stages: ${fastStages.join(' → ')}`);
        logInfo(`STANDARD stages: ${standardStages.join(' → ')}`);
    } catch (e) {
        logFail(`Config check failed: ${e.message}`);
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
