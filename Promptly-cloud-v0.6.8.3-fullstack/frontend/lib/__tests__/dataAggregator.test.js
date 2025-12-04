/**
 * Data Aggregator Test Suite
 * 
 * Tests for the PromptlyDataAggregator class:
 * - Layer 1: Task description, model selection, context
 * - Layer 2: Instructions, examples, constraints (Blueprint sync)
 * - Layer 3: Dataset snippets, schema templates, optimization knobs (Expert lab)
 * 
 * This test file creates a mock DOM environment to test the aggregator
 * without running in a browser.
 * 
 * Run with: node lib/__tests__/dataAggregator.test.js
 */

// Simple DOM mocking for Node.js environment
class MockElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.value = '';
    this.textContent = '';
    this.classList = {
      _classes: new Set(),
      contains: (cls) => this.classList._classes.has(cls),
      add: (cls) => this.classList._classes.add(cls),
      remove: (cls) => this.classList._classes.delete(cls)
    };
    this.children = [];
    this.parent = null;
    this.id = '';
    this.attributes = {};
  }

  querySelector(selector) {
    return null;
  }

  querySelectorAll(selector) {
    return [];
  }

  closest(selector) {
    return null;
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

class MockDocument {
  constructor() {
    this.elements = {};
  }

  getElementById(id) {
    return this.elements[id] || null;
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }
    if (selector === '.model-select__name') {
      return this.elements['__model_name'] || null;
    }
    return null;
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  addElement(id, element) {
    this.elements[id] = element;
    element.id = id;
  }
}

class MockSessionStorage {
  constructor() {
    this.data = {};
  }

  getItem(key) {
    return this.data[key] || null;
  }

  setItem(key, value) {
    this.data[key] = value;
  }

  removeItem(key) {
    delete this.data[key];
  }
}

// Set up global mocks
global.document = new MockDocument();
global.sessionStorage = new MockSessionStorage();

/**
 * PromptlyDataAggregator - Direct class definition for testing
 * 
 * This is a simplified version of the frontend dataAggregator.js
 * that works in Node.js without DOM dependencies.
 */
class PromptlyDataAggregator {
  constructor() {
    this.data = {
      layer1: {},
      layer2: {},
      layer3: {},
      _meta: {
        layer2Used: false,
        layer3Used: false,
        timestamp: null,
        version: '0.6.8.3'
      }
    };
  }

  collect() {
    this._collectLayer1();
    this._collectLayer2();
    this._collectLayer3();
    this.data._meta.timestamp = new Date().toISOString();
    return this.data;
  }

  _collectLayer1() {
    const taskEl = document.getElementById('task');
    this.data.layer1.task = taskEl?.value?.trim() || '';

    const modelNameEl = document.querySelector('.model-select__name');
    let model = 'promptly-mini';

    if (modelNameEl) {
      const modelLabel = modelNameEl.textContent?.trim() || '';
      const modelMap = {
        'Promptly Mini': 'promptly-mini',
        'Promptly': 'promptly',
        'Promptly Plus': 'promptly-plus',
        'Promptly Pro': 'promptly-pro',
        'Promptly Pro Max': 'promptly-pro-max',
        'Promptly Code Mini': 'promptly-code-mini',
        'Promptly Code': 'promptly-code',
        'Promptly Code Plus': 'promptly-code-plus',
        'Promptly Code Pro': 'promptly-code-pro',
        'Promptly Code Pro Max': 'promptly-code-pro-max'
      };
      model = modelMap[modelLabel] || 'promptly-mini';
    }

    const storedModel = sessionStorage.getItem('promptly:model-selection');
    if (storedModel) {
      model = storedModel;
    }

    this.data.layer1.model = model;

    const examplesEl = document.getElementById('examples');
    this.data.layer1.examples = examplesEl?.value?.trim() || '';
  }

  _collectLayer2() {
    const advancedPanel = document.getElementById('advancedPanel');
    const isPanelOpen = advancedPanel?.classList.contains('layer-panel--open');

    const instructionsEl = document.getElementById('blueprintInstructions');
    const examplesEl = document.getElementById('blueprintExamples');
    const constraintsEl = document.getElementById('blueprintConstraints');

    const instructions = instructionsEl?.value?.trim() || '';
    const examples = examplesEl?.value?.trim() || '';
    const constraints = constraintsEl?.value?.trim() || '';

    const hasContent = instructions || examples || constraints;

    if (isPanelOpen && hasContent) {
      this.data.layer2 = {
        instructions,
        examples,
        constraints
      };
      this.data._meta.layer2Used = true;
    } else {
      this.data.layer2 = {};
      this.data._meta.layer2Used = false;
    }
  }

  _collectLayer3() {
    const expertPanel = document.getElementById('expertPanel');
    const isPanelOpen = expertPanel?.classList.contains('layer-panel--open');

    // Simplified for testing - just check for basic fields
    if (isPanelOpen) {
      this.data.layer3 = {
        datasetSnippets: '',
        schemaTemplate: '',
        optimizationKnobs: {}
      };
      this.data._meta.layer3Used = true;
    } else {
      this.data.layer3 = {};
      this.data._meta.layer3Used = false;
    }
  }

  _parseYamlLikeSettings(text) {
    if (!text) return {};

    const result = {};
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'));
        } catch {
          value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
        }
      } else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (value !== '' && !isNaN(parseFloat(value)) && isFinite(Number(value))) {
        value = Number(value);
      }

      result[key] = value;
    }

    return result;
  }

  validate() {
    const errors = [];

    if (!this.data.layer1.task) {
      errors.push('Layer 1: Task description is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  toAPI() {
    const payload = {
      task: this.data.layer1.task,
      model: this.data.layer1.model,
      n: 4,
      _meta: this.data._meta
    };

    if (this.data.layer1.examples) {
      payload.examples = this.data.layer1.examples;
    }

    if (this.data._meta.layer2Used) {
      if (this.data.layer2.instructions) {
        payload.input = this.data.layer2.instructions;
      }
      if (this.data.layer2.examples) {
        payload.style = this.data.layer2.examples;
      }
      if (this.data.layer2.constraints) {
        payload.constraints = this.data.layer2.constraints;
      }
    }

    if (this.data._meta.layer3Used) {
      if (this.data.layer3.datasetSnippets) {
        payload.dataset = this.data.layer3.datasetSnippets;
      }
      if (this.data.layer3.schemaTemplate) {
        payload.schema = this.data.layer3.schemaTemplate;
      }
      if (this.data.layer3.optimizationKnobs) {
        const knobs = this.data.layer3.optimizationKnobs;
        if (knobs.candidates) payload.n = knobs.candidates;
        if (knobs.tests) payload.tests = { from: knobs.tests };
        if (knobs.temperature) payload.temperature = knobs.temperature;
      }
    }

    return payload;
  }

  getSummary() {
    const summary = {
      layer1: {
        hasTask: !!this.data.layer1.task,
        taskLength: this.data.layer1.task?.length || 0,
        model: this.data.layer1.model,
        hasExamples: !!this.data.layer1.examples
      },
      layer2: {
        used: this.data._meta.layer2Used,
        hasInstructions: !!this.data.layer2?.instructions,
        hasExamples: !!this.data.layer2?.examples,
        hasConstraints: !!this.data.layer2?.constraints
      },
      layer3: {
        used: this.data._meta.layer3Used,
        hasDataset: !!this.data.layer3?.datasetSnippets,
        hasSchema: !!this.data.layer3?.schemaTemplate,
        hasKnobs: Object.keys(this.data.layer3?.optimizationKnobs || {}).length > 0
      }
    };

    const parts = [];
    parts.push('Task: ' + summary.layer1.taskLength + ' chars');
    parts.push('Model: ' + summary.layer1.model);

    if (summary.layer2.used) {
      const layer2Parts = [];
      if (summary.layer2.hasInstructions) layer2Parts.push('instructions');
      if (summary.layer2.hasExamples) layer2Parts.push('examples');
      if (summary.layer2.hasConstraints) layer2Parts.push('constraints');
      parts.push('Blueprint: ' + layer2Parts.join(', '));
    }

    if (summary.layer3.used) {
      const layer3Parts = [];
      if (summary.layer3.hasDataset) layer3Parts.push('dataset');
      if (summary.layer3.hasSchema) layer3Parts.push('schema');
      if (summary.layer3.hasKnobs) layer3Parts.push('knobs');
      parts.push('Expert: ' + layer3Parts.join(', '));
    }

    summary.description = parts.join(' | ');
    return summary;
  }
}

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

function resetDOM() {
  global.document = new MockDocument();
  global.sessionStorage = new MockSessionStorage();
}

// ============================================
// TEST SUITE
// ============================================

describe('PromptlyDataAggregator - Initialization', () => {
  resetDOM();
  const aggregator = new PromptlyDataAggregator();
  
  assert(aggregator.data.layer1 !== undefined, 'Initializes layer1 object');
  assert(aggregator.data.layer2 !== undefined, 'Initializes layer2 object');
  assert(aggregator.data.layer3 !== undefined, 'Initializes layer3 object');
  assert(aggregator.data._meta !== undefined, 'Initializes _meta object');
  assert(aggregator.data._meta.version === '0.6.8.3', 'Has correct version');
  assert(aggregator.data._meta.layer2Used === false, 'layer2Used starts as false');
  assert(aggregator.data._meta.layer3Used === false, 'layer3Used starts as false');
});

describe('PromptlyDataAggregator - Layer 1 Collection', () => {
  resetDOM();
  
  // Set up mock elements
  const taskEl = new MockElement('textarea');
  taskEl.value = '  Classify sentiment of customer reviews  ';
  document.addElement('task', taskEl);
  
  const examplesEl = new MockElement('textarea');
  examplesEl.value = 'POS || Great product!\nNEG || Terrible service.';
  document.addElement('examples', examplesEl);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  assert(aggregator.data.layer1.task === 'Classify sentiment of customer reviews', 'Collects and trims task');
  assert(aggregator.data.layer1.examples.includes('Great product'), 'Collects examples');
  assert(aggregator.data.layer1.model === 'promptly-mini', 'Uses default model');
});

describe('PromptlyDataAggregator - Model Selection from SessionStorage', () => {
  resetDOM();
  
  const taskEl = new MockElement('textarea');
  taskEl.value = 'Test task';
  document.addElement('task', taskEl);
  
  sessionStorage.setItem('promptly:model-selection', 'promptly-pro');
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  assert(aggregator.data.layer1.model === 'promptly-pro', 'Uses model from sessionStorage');
});

describe('PromptlyDataAggregator - Layer 2 Collection (Panel Closed)', () => {
  resetDOM();
  
  const advancedPanel = new MockElement('div');
  // Panel is closed (no 'layer-panel--open' class)
  document.addElement('advancedPanel', advancedPanel);
  
  const instructionsEl = new MockElement('textarea');
  instructionsEl.value = 'Some instructions';
  document.addElement('blueprintInstructions', instructionsEl);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  assert(aggregator.data._meta.layer2Used === false, 'layer2Used is false when panel closed');
  assert(Object.keys(aggregator.data.layer2).length === 0, 'layer2 is empty when panel closed');
});

describe('PromptlyDataAggregator - Layer 2 Collection (Panel Open)', () => {
  resetDOM();
  
  const advancedPanel = new MockElement('div');
  advancedPanel.classList.add('layer-panel--open');
  document.addElement('advancedPanel', advancedPanel);
  
  const instructionsEl = new MockElement('textarea');
  instructionsEl.value = 'Step-by-step instructions';
  document.addElement('blueprintInstructions', instructionsEl);
  
  const examplesEl = new MockElement('textarea');
  examplesEl.value = 'Input: hello\nOutput: greeting';
  document.addElement('blueprintExamples', examplesEl);
  
  const constraintsEl = new MockElement('textarea');
  constraintsEl.value = 'Max 100 words';
  document.addElement('blueprintConstraints', constraintsEl);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  assert(aggregator.data._meta.layer2Used === true, 'layer2Used is true when panel open with content');
  assert(aggregator.data.layer2.instructions === 'Step-by-step instructions', 'Collects instructions');
  assert(aggregator.data.layer2.examples.includes('Input: hello'), 'Collects examples');
  assert(aggregator.data.layer2.constraints === 'Max 100 words', 'Collects constraints');
});

describe('PromptlyDataAggregator - Layer 2 Empty Content', () => {
  resetDOM();
  
  const advancedPanel = new MockElement('div');
  advancedPanel.classList.add('layer-panel--open');
  document.addElement('advancedPanel', advancedPanel);
  
  // Empty textareas
  document.addElement('blueprintInstructions', new MockElement('textarea'));
  document.addElement('blueprintExamples', new MockElement('textarea'));
  document.addElement('blueprintConstraints', new MockElement('textarea'));
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  assert(aggregator.data._meta.layer2Used === false, 'layer2Used is false when panel open but empty');
});

describe('PromptlyDataAggregator - Layer 3 Collection', () => {
  resetDOM();
  
  const expertPanel = new MockElement('div');
  expertPanel.classList.add('layer-panel--open');
  document.addElement('expertPanel', expertPanel);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  assert(aggregator.data._meta.layer3Used === true, 'layer3Used is true when panel open');
});

describe('PromptlyDataAggregator - YAML Settings Parser', () => {
  resetDOM();
  const aggregator = new PromptlyDataAggregator();
  
  // Test various YAML-like formats
  const parsed = aggregator._parseYamlLikeSettings(`
    candidates: 4
    temperature: 0.7
    enabled: true
    disabled: false
    tests: ['clarity', 'risk']
  `);
  
  assert(parsed.candidates === 4, 'Parses numeric values');
  assert(parsed.temperature === 0.7, 'Parses float values');
  assert(parsed.enabled === true, 'Parses true boolean');
  assert(parsed.disabled === false, 'Parses false boolean');
  assert(Array.isArray(parsed.tests), 'Parses arrays');
  assert(parsed.tests.includes('clarity'), 'Array contains correct values');
});

describe('PromptlyDataAggregator - YAML Parser Edge Cases', () => {
  resetDOM();
  const aggregator = new PromptlyDataAggregator();
  
  // Empty input
  assert(Object.keys(aggregator._parseYamlLikeSettings('')).length === 0, 'Returns empty object for empty input');
  assert(Object.keys(aggregator._parseYamlLikeSettings(null)).length === 0, 'Returns empty object for null input');
  
  // Comments
  const withComments = aggregator._parseYamlLikeSettings(`
    # This is a comment
    key: value
    # Another comment
  `);
  assert(withComments.key === 'value', 'Ignores comments');
  assert(Object.keys(withComments).length === 1, 'Only parses non-comment lines');
  
  // No colon
  const noColon = aggregator._parseYamlLikeSettings('no colon here');
  assert(Object.keys(noColon).length === 0, 'Ignores lines without colon');
});

describe('PromptlyDataAggregator - Validation', () => {
  resetDOM();
  
  // Valid case
  const taskEl = new MockElement('textarea');
  taskEl.value = 'Valid task description';
  document.addElement('task', taskEl);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  const validResult = aggregator.validate();
  assert(validResult.isValid === true, 'Returns isValid: true when task provided');
  assert(validResult.errors.length === 0, 'No errors when valid');
  
  // Invalid case - missing task
  resetDOM();
  const emptyAggregator = new PromptlyDataAggregator();
  emptyAggregator.collect();
  
  const invalidResult = emptyAggregator.validate();
  assert(invalidResult.isValid === false, 'Returns isValid: false when task missing');
  assert(invalidResult.errors.length > 0, 'Contains error messages');
  assert(invalidResult.errors[0].includes('Task description is required'), 'Error mentions required task');
});

describe('PromptlyDataAggregator - toAPI() Transformation', () => {
  resetDOM();
  
  const taskEl = new MockElement('textarea');
  taskEl.value = 'Generate product descriptions';
  document.addElement('task', taskEl);
  
  const examplesEl = new MockElement('textarea');
  examplesEl.value = 'Example product';
  document.addElement('examples', examplesEl);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  const payload = aggregator.toAPI();
  
  assert(payload.task === 'Generate product descriptions', 'Includes task in payload');
  assert(payload.model === 'promptly-mini', 'Includes model in payload');
  assert(payload.n === 4, 'Includes default n=4');
  assert(payload.examples === 'Example product', 'Includes examples in payload');
  assert(payload._meta !== undefined, 'Includes _meta');
});

describe('PromptlyDataAggregator - toAPI() with Layer 2', () => {
  resetDOM();
  
  const taskEl = new MockElement('textarea');
  taskEl.value = 'Test task';
  document.addElement('task', taskEl);
  
  const advancedPanel = new MockElement('div');
  advancedPanel.classList.add('layer-panel--open');
  document.addElement('advancedPanel', advancedPanel);
  
  const instructionsEl = new MockElement('textarea');
  instructionsEl.value = 'Be concise';
  document.addElement('blueprintInstructions', instructionsEl);
  
  const stylesEl = new MockElement('textarea');
  stylesEl.value = 'Professional tone';
  document.addElement('blueprintExamples', stylesEl);
  
  const constraintsEl = new MockElement('textarea');
  constraintsEl.value = 'Under 50 words';
  document.addElement('blueprintConstraints', constraintsEl);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  const payload = aggregator.toAPI();
  
  assert(payload.input === 'Be concise', 'Maps instructions to input');
  assert(payload.style === 'Professional tone', 'Maps examples to style');
  assert(payload.constraints === 'Under 50 words', 'Maps constraints');
});

describe('PromptlyDataAggregator - getSummary()', () => {
  resetDOM();
  
  const taskEl = new MockElement('textarea');
  taskEl.value = 'Test task for summary';
  document.addElement('task', taskEl);
  
  const aggregator = new PromptlyDataAggregator();
  aggregator.collect();
  
  const summary = aggregator.getSummary();
  
  assert(summary.layer1.hasTask === true, 'Summary shows hasTask');
  assert(summary.layer1.taskLength === 21, 'Summary shows correct task length');
  assert(summary.layer1.model === 'promptly-mini', 'Summary shows model');
  assert(summary.layer2.used === false, 'Summary shows layer2 not used');
  assert(summary.layer3.used === false, 'Summary shows layer3 not used');
  assert(summary.description.includes('Task: 21 chars'), 'Description includes task info');
  assert(summary.description.includes('Model: promptly-mini'), 'Description includes model');
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
  console.log('\n✅ All data aggregator tests passed!\n');
  process.exit(0);
}
