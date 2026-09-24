/**
 * Spec Compiler Test Suite
 * 
 * Tests for spec compilation in specCompiler.js:
 * - compileSpecToPrompt: Converts spec object to structured prompt blocks
 * 
 * Run with: node src/lib/__tests__/specCompiler.test.js
 */

import { compileSpecToPrompt } from '../specCompiler.js';

// Simple test framework
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message}`);
  }
}

function describe(suiteName, fn) {
  console.log(`\n📋 ${suiteName}`);
  fn();
}

// ============================================
// TEST SUITE
// ============================================

describe('compileSpecToPrompt - Basic Structure', () => {
  const result = compileSpecToPrompt({});
  
  assert(result.id && result.id.startsWith('prompt_'), 'Returns result with id starting with "prompt_"');
  assert(Array.isArray(result.blocks), 'Returns blocks as an array');
  assert(typeof result.explanation === 'string', 'Returns explanation as string');
});

describe('compileSpecToPrompt - System Role Block', () => {
  const result = compileSpecToPrompt({});
  
  const systemBlock = result.blocks.find(b => b.role === 'system');
  
  assert(systemBlock !== undefined, 'Includes system role block');
  assert(systemBlock.label === 'System Role', 'System block has correct label');
  assert(systemBlock.content.includes('AI coding assistant'), 'System block mentions AI assistant role');
  assert(systemBlock.content.includes('deterministic'), 'System block mentions deterministic behavior');
});

describe('compileSpecToPrompt - Project Goal Block', () => {
  const result = compileSpecToPrompt({
    project_goal: 'Build a todo app with user authentication'
  });
  
  const goalBlock = result.blocks.find(b => b.label === 'Project Goal');
  
  assert(goalBlock !== undefined, 'Includes project goal block');
  assert(goalBlock.role === 'user', 'Project goal block has user role');
  assert(goalBlock.content === 'Build a todo app with user authentication', 'Contains the correct project goal');
});

describe('compileSpecToPrompt - Objectives Summary Fallback', () => {
  const result = compileSpecToPrompt({
    objectives: { summary: 'Create a REST API for inventory management' }
  });
  
  const goalBlock = result.blocks.find(b => b.label === 'Project Goal');
  
  assert(goalBlock !== undefined, 'Includes project goal block from objectives.summary');
  assert(goalBlock.content === 'Create a REST API for inventory management', 'Falls back to objectives.summary');
});

describe('compileSpecToPrompt - Actors Block', () => {
  const result = compileSpecToPrompt({
    actors: ['Admin', 'User', 'Guest']
  });
  
  const actorsBlock = result.blocks.find(b => b.label === 'Actors / Users');
  
  assert(actorsBlock !== undefined, 'Includes actors block when actors provided');
  assert(actorsBlock.role === 'user', 'Actors block has user role');
  assert(actorsBlock.content.includes('Admin'), 'Actors content includes actor names');
});

describe('compileSpecToPrompt - Flows Block', () => {
  const result = compileSpecToPrompt({
    flows: [
      { name: 'Login', steps: ['Enter email', 'Enter password', 'Click submit'] },
      { name: 'Logout', steps: ['Click logout button'] }
    ]
  });
  
  const flowsBlock = result.blocks.find(b => b.label === 'Key User Flows');
  
  assert(flowsBlock !== undefined, 'Includes flows block when flows provided');
  assert(flowsBlock.content.includes('Login'), 'Flows content includes flow names');
});

describe('compileSpecToPrompt - Requirements Block', () => {
  const result = compileSpecToPrompt({
    requirements: [
      'Must support mobile browsers',
      'Response time under 200ms'
    ]
  });
  
  const reqBlock = result.blocks.find(b => b.label === 'Functional Requirements');
  
  assert(reqBlock !== undefined, 'Includes requirements block');
  assert(reqBlock.content.includes('mobile browsers'), 'Requirements content is included');
});

describe('compileSpecToPrompt - Data Models Block', () => {
  const result = compileSpecToPrompt({
    data: {
      entities: ['User', 'Post', 'Comment'],
      relationships: ['User has many Posts', 'Post has many Comments']
    }
  });
  
  const dataBlock = result.blocks.find(b => b.label === 'Data & Models');
  
  assert(dataBlock !== undefined, 'Includes data block');
  assert(dataBlock.content.includes('User'), 'Data content includes entity names');
});

describe('compileSpecToPrompt - Constraints Block', () => {
  const result = compileSpecToPrompt({
    constraints: {
      performance: 'Response time < 100ms',
      security: 'Must use HTTPS'
    }
  });
  
  const constraintsBlock = result.blocks.find(b => b.label === 'Constraints');
  
  assert(constraintsBlock !== undefined, 'Includes constraints block');
  assert(constraintsBlock.content.includes('performance'), 'Constraints content is included');
});

describe('compileSpecToPrompt - Evaluation Criteria Block', () => {
  const result = compileSpecToPrompt({
    evaluation_criteria: {
      accuracy: 'Must correctly parse 95% of inputs',
      coverage: 'Must handle all edge cases'
    }
  });
  
  const evalBlock = result.blocks.find(b => b.label === "What 'Good' Looks Like");
  
  assert(evalBlock !== undefined, 'Includes evaluation criteria block');
  assert(evalBlock.content.includes('accuracy'), 'Evaluation content is included');
});

describe('compileSpecToPrompt - UI/UX Block', () => {
  const result = compileSpecToPrompt({
    ui_ux: {
      style: 'Modern, minimal design',
      accessibility: 'WCAG 2.1 AA compliant'
    }
  });
  
  const uiBlock = result.blocks.find(b => b.label === 'UI / UX Notes');
  
  assert(uiBlock !== undefined, 'Includes UI/UX block');
  assert(uiBlock.content.includes('minimal design'), 'UI/UX content is included');
});

describe('compileSpecToPrompt - Architecture Block', () => {
  const result = compileSpecToPrompt({
    architecture: {
      frontend: 'React with TypeScript',
      backend: 'Node.js with Express',
      database: 'PostgreSQL'
    }
  });
  
  const archBlock = result.blocks.find(b => b.label === 'Architecture');
  
  assert(archBlock !== undefined, 'Includes architecture block');
  assert(archBlock.content.includes('React'), 'Architecture content is included');
});

describe('compileSpecToPrompt - Output Format Block', () => {
  const result = compileSpecToPrompt({});
  
  const outputBlock = result.blocks.find(b => b.label === 'Output Format');
  
  assert(outputBlock !== undefined, 'Includes output format block');
  assert(outputBlock.content.includes('FILE:'), 'Output format mentions file boundaries');
});

describe('compileSpecToPrompt - Validation Block', () => {
  const result = compileSpecToPrompt({});
  
  const validationBlock = result.blocks.find(b => b.label === 'Validation & Determinism');
  
  assert(validationBlock !== undefined, 'Includes validation block');
  assert(validationBlock.content.includes('required files'), 'Validation mentions completeness check');
  assert(validationBlock.content.includes('unresolved imports'), 'Validation mentions import checks');
});

describe('compileSpecToPrompt - Explanation', () => {
  const result = compileSpecToPrompt({});
  
  assert(result.explanation.includes('compiled from the spec'), 'Explanation describes compilation');
  assert(result.explanation.includes('fixed ordering'), 'Explanation mentions ordering');
});

describe('compileSpecToPrompt - Complete Wizard Session Spec', () => {
  // Simulating a complete wizard-generated spec
  const wizardSpec = {
    title: 'E-commerce Shopping Cart',
    project_goal: 'Build a shopping cart system for an online store',
    actors: [
      { name: 'Customer', description: 'End user browsing and purchasing products' },
      { name: 'Admin', description: 'Store administrator managing inventory' }
    ],
    flows: [
      { name: 'Add to Cart', steps: ['Browse products', 'Click add', 'View cart'] },
      { name: 'Checkout', steps: ['Review cart', 'Enter payment', 'Confirm order'] }
    ],
    requirements: [
      'Real-time inventory updates',
      'Multiple payment methods',
      'Order history for customers'
    ],
    data: {
      entities: ['Product', 'Cart', 'Order', 'Customer'],
      relationships: ['Cart contains Products', 'Customer has Orders']
    },
    constraints: {
      performance: 'Cart operations < 100ms',
      scalability: 'Support 10K concurrent users'
    },
    evaluation_criteria: {
      functionality: 'All checkout flows complete without errors',
      usability: 'Accessible on mobile devices'
    },
    ui_ux: {
      design: 'Clean, modern checkout flow',
      accessibility: 'Screen reader compatible'
    },
    architecture: {
      frontend: 'React',
      backend: 'Node.js',
      database: 'MongoDB'
    }
  };
  
  const result = compileSpecToPrompt(wizardSpec);
  
  // Check that all expected blocks are present
  const blockLabels = result.blocks.map(b => b.label);
  
  assert(blockLabels.includes('System Role'), 'Has System Role block');
  assert(blockLabels.includes('Project Goal'), 'Has Project Goal block');
  assert(blockLabels.includes('Actors / Users'), 'Has Actors block');
  assert(blockLabels.includes('Key User Flows'), 'Has Flows block');
  assert(blockLabels.includes('Functional Requirements'), 'Has Requirements block');
  assert(blockLabels.includes('Data & Models'), 'Has Data block');
  assert(blockLabels.includes('Constraints'), 'Has Constraints block');
  assert(blockLabels.includes("What 'Good' Looks Like"), 'Has Evaluation block');
  assert(blockLabels.includes('UI / UX Notes'), 'Has UI/UX block');
  assert(blockLabels.includes('Architecture'), 'Has Architecture block');
  assert(blockLabels.includes('Output Format'), 'Has Output Format block');
  assert(blockLabels.includes('Validation & Determinism'), 'Has Validation block');
  
  // Verify ordering (system first, validation last)
  assert(result.blocks[0].label === 'System Role', 'System Role is first block');
  assert(result.blocks[result.blocks.length - 1].label === 'Validation & Determinism', 'Validation is last block');
  
  // Verify content includes wizard inputs
  const goalBlock = result.blocks.find(b => b.label === 'Project Goal');
  assert(goalBlock.content.includes('shopping cart'), 'Project goal from wizard is included');
  
  console.log(`  ℹ️  Complete spec generated ${result.blocks.length} blocks`);
});

describe('compileSpecToPrompt - Omits Empty Sections', () => {
  // Spec with only some sections filled
  const partialSpec = {
    project_goal: 'Simple task',
    requirements: ['Basic requirement']
    // No actors, flows, data, constraints, etc.
  };
  
  const result = compileSpecToPrompt(partialSpec);
  const blockLabels = result.blocks.map(b => b.label);
  
  assert(!blockLabels.includes('Actors / Users'), 'Omits Actors block when not provided');
  assert(!blockLabels.includes('Key User Flows'), 'Omits Flows block when not provided');
  assert(!blockLabels.includes('Data & Models'), 'Omits Data block when not provided');
  assert(!blockLabels.includes('Constraints'), 'Omits Constraints block when not provided');
  
  assert(blockLabels.includes('Project Goal'), 'Includes Project Goal when provided');
  assert(blockLabels.includes('Functional Requirements'), 'Includes Requirements when provided');
  
  // Should still include standard blocks
  assert(blockLabels.includes('System Role'), 'Always includes System Role');
  assert(blockLabels.includes('Output Format'), 'Always includes Output Format');
  assert(blockLabels.includes('Validation & Determinism'), 'Always includes Validation');
});

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All spec compiler tests passed!\n');
  process.exit(0);
}
