
import { chatJson, chatText } from './src/lib/llmRouter.js';

// 简单的颜色输出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function logPass(msg) { console.log(`${colors.green}PASS${colors.reset}: ${msg}`); }
function logFail(msg) { console.log(`${colors.red}FAIL${colors.reset}: ${msg}`); }
function logInfo(msg) { console.log(`${colors.yellow}INFO${colors.reset}: ${msg}`); }

// 劫持 console.error 来捕捉 Client 的报错信息
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

let capturedLogs = [];

function hijackConsole() {
    capturedLogs = [];
    console.error = (...args) => {
        capturedLogs.push(args.join(' '));
        // originalConsoleError(...args); // 可以选择是否静默
    };
    console.log = (...args) => {
        capturedLogs.push(args.join(' '));
    };
}

function restoreConsole() {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
}

async function testDispatch() {
    console.log("=== 开始测试 Router 分发逻辑 ===\n");

    // Test 1: OpenAI Dispatch (chatJson)
    logInfo("Test 1: Testing chatJson with provider='openai'");
    hijackConsole();
    try {
        await chatJson({ 
            system: 'sys', 
            user: 'usr', 
            model: 'gpt-4', 
            provider: 'openai' 
        });
    } catch (e) {
        // Expected error if no API key, but we care about WHO threw it
    }
    restoreConsole();
    
    const openAICalled = capturedLogs.some(log => 
        log.includes("OpenAI client not initialized") || 
        log.includes("Calling OpenAI API") ||
        log.includes("Type: chatJson")
    );
    const groqCalled = capturedLogs.some(log => 
        log.includes("Groq client not initialized") || 
        log.includes("Starting Groq call")
    );

    if (openAICalled && !groqCalled) {
        logPass("Router 正确分发给了 OpenAI Client");
    } else {
        logFail(`分发错误. OpenAI Called: ${openAICalled}, Groq Called: ${groqCalled}`);
        console.log("Logs:", capturedLogs);
    }

    // Test 2: Groq Dispatch (chatJson)
    logInfo("\nTest 2: Testing chatJson with provider='groq'");
    hijackConsole();
    try {
        await chatJson({ 
            system: 'sys', 
            user: 'usr', 
            model: 'llama3', 
            provider: 'groq' 
        });
    } catch (e) {}
    restoreConsole();

    const groqCalled2 = capturedLogs.some(log => 
        log.includes("Groq client not initialized") || 
        log.includes("Starting Groq call")
    );
    const openAICalled2 = capturedLogs.some(log => 
        log.includes("OpenAI client not initialized") || 
        log.includes("Calling OpenAI API")
    );

    if (groqCalled2 && !openAICalled2) {
        logPass("Router 正确分发给了 Groq Client");
    } else {
        logFail(`分发错误. Groq Called: ${groqCalled2}, OpenAI Called: ${openAICalled2}`);
        console.log("Logs:", capturedLogs);
    }

    // Test 3: Default Dispatch (no provider specified) -> Should be OpenAI
    logInfo("\nTest 3: Testing chatText with no provider (Default)");
    hijackConsole();
    try {
        await chatText({ 
            system: 'sys', 
            user: 'usr', 
            model: 'gpt-4' 
        });
    } catch (e) {}
    restoreConsole();

    const openAICalled3 = capturedLogs.some(log => 
        log.includes("OpenAI client not initialized") || 
        log.includes("Calling OpenAI API") ||
        log.includes("Type: chatText")
    );
    
    if (openAICalled3) {
        logPass("Router 默认分发给了 OpenAI Client");
    } else {
        logFail("分发错误. 默认应该调用 OpenAI");
        console.log("Logs:", capturedLogs);
    }

    console.log("\n=== 测试结束 ===");
}

testDispatch();
