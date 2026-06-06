'use strict';

// ============================================================
// === PARSER
//
// Shunting-yard algorithm — no eval().
//
// HOW TO EXPAND (Phase 2):
//   • Add an operator:  add an entry to OPERATORS
//   • Add a function:   add an entry to FUNCTIONS
//   • Add a constant:   add an entry to CONSTANTS
//   Nothing else needs to change. The tokenizer and evaluator
//   automatically pick up new entries from these tables.
// ============================================================

/**
 * Operator table.
 * prec: precedence (higher = binds tighter)
 * assoc: 'L' (left) or 'R' (right)
 * fn: (a, b) -> number
 *
 * Phase 2 — uncomment to add:
 *   '^': { prec: 3, assoc: 'R', fn: (a, b) => Math.pow(a, b) },
 */
const OPERATORS = {
  '+': { prec: 1, assoc: 'L', fn: (a, b) => a + b },
  '-': { prec: 1, assoc: 'L', fn: (a, b) => a - b },
  '*': { prec: 2, assoc: 'L', fn: (a, b) => a * b },
  '/': { prec: 2, assoc: 'L', fn: (a, b) => {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  }},
  '^': { prec: 3, assoc: 'R', fn: (a, b) => Math.pow(a, b) },
};

/**
 * Function table.
 * args: number of arguments
 * fn: (...args) -> number
 *
 * Phase 2 examples:
 *   cos: { args: 1, fn: (x) => Math.cos(state.degRad === 'deg' ? x * Math.PI / 180 : x) },
 *   tan: { args: 1, fn: (x) => Math.tan(state.degRad === 'deg' ? x * Math.PI / 180 : x) },
 *   log: { args: 1, fn: (x) => Math.log10(x) },
 *   ln:  { args: 1, fn: (x) => Math.log(x) },
 *   sqrt:{ args: 1, fn: (x) => Math.sqrt(x) },
 */
const FUNCTIONS = {
  sin: { args: 1, fn: (x) => Math.sin(state.degRad === 'deg' ? x * Math.PI / 180 : x) },
  cos: { args: 1, fn: (x) => Math.cos(state.degRad === 'deg' ? x * Math.PI / 180 : x) },
  tan: { args: 1, fn: (x) => Math.tan(state.degRad === 'deg' ? x * Math.PI / 180 : x) },
  'sin⁻¹': { args: 1, fn: (x) => {
    if (x < -1 || x > 1) throw new Error('sin⁻¹ domain error');
    const r = Math.asin(x);
    return state.degRad === 'deg' ? r * 180 / Math.PI : r;
  }},
  'cos⁻¹': { args: 1, fn: (x) => {
    if (x < -1 || x > 1) throw new Error('cos⁻¹ domain error');
    const r = Math.acos(x);
    return state.degRad === 'deg' ? r * 180 / Math.PI : r;
  }},
  'tan⁻¹': { args: 1, fn: (x) => {
    const r = Math.atan(x);
    return state.degRad === 'deg' ? r * 180 / Math.PI : r;
  }},
  '√': { args: 1, fn: (x) => {
    if (x < 0) throw new Error('√ domain error');
    return Math.sqrt(x);
  }},
};

/**
 * Constants substituted as text before tokenizing.
 * Phase 2:
 *   π: String(Math.PI),
 *   e: String(Math.E),
 */
const CONSTANTS = {
};

/**
 * Engineering prefix multipliers.
 * Single letter after a number: 10p → 10 × 10⁻¹²
 */
const PREFIXES = {
  'a': 1e-18,   // atto
  'f': 1e-15,   // femto
  'p': 1e-12,   // pico
  'n': 1e-9,    // nano
  'u': 1e-6,    // micro (μ)
  'μ': 1e-6,    // micro (μ)
  'm': 1e-3,    // milli
  'k': 1e3,     // kilo
  'M': 1e6,     // mega
  'G': 1e9,     // giga
  'T': 1e12,    // tera
};

/** Replace constant names in the expression string. */
function substituteConstants(expr) {
  let result = expr;
  for (const [name, value] of Object.entries(CONSTANTS)) {
    result = result.split(name).join(value);
  }
  return result;
}

/**
 * Tokenize an expression string.
 * Token shapes:
 *   { type: 'number',   value: number }
 *   { type: 'operator', value: string }
 *   { type: 'function', value: string }
 *   { type: 'lparen' }
 *   { type: 'rparen' }
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (ch === ' ') { i++; continue; }

    // Number (integer or decimal), with optional engineering prefix
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
      const val = parseFloat(num);
      if (isNaN(val)) throw new Error('Invalid number: ' + num);
      // Check for engineering prefix
      if (i < expr.length && /[afpnumkμgt]/i.test(expr[i])) {
        const pfx = expr[i];
        if (pfx in PREFIXES) {
          tokens.push({ type: 'number', value: val * PREFIXES[pfx] });
          i++;
        } else {
          tokens.push({ type: 'number', value: val });
        }
      } else {
        tokens.push({ type: 'number', value: val });
      }
      continue;
    }

    // Square root symbol — single-char function
    if (ch === '√') {
      tokens.push({ type: 'function', value: '√' });
      i++;
      continue;
    }

    // Pi constant — insert implicit * if preceded by number or rparen
    if (ch === 'π') {
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.type === 'number' || prev.type === 'rparen')) {
        tokens.push({ type: 'operator', value: '*' });
      }
      tokens.push({ type: 'number', value: Math.PI });
      i++;
      continue;
    }

    // Superscript ² — acts as ^2
    if (ch === '²') {
      tokens.push({ type: 'operator', value: '^' });
      tokens.push({ type: 'number', value: 2 });
      i++;
      continue;
    }

    // Superscript ³ — acts as ^3
    if (ch === '³') {
      tokens.push({ type: 'operator', value: '^' });
      tokens.push({ type: 'number', value: 3 });
      i++;
      continue;
    }

    // Superscript ⁻¹ — acts as ^(-1)
    if (ch === '⁻') {
      if (i + 1 < expr.length && expr[i + 1] === '¹') {
        tokens.push({ type: 'operator', value: '^' });
        tokens.push({ type: 'lparen' });
        tokens.push({ type: 'number', value: 0 });
        tokens.push({ type: 'operator', value: '-' });
        tokens.push({ type: 'number', value: 1 });
        tokens.push({ type: 'rparen' });
        i += 2;
        continue;
      }
    }

    // Identifier — must be a known function name (may include ⁻¹ suffix)
    if (/[a-z]/i.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-z]/i.test(expr[i])) name += expr[i++];
      // Check for ⁻¹ suffix (U+207B U+00B9)
      if (i + 1 < expr.length && expr[i] === '⁻' && expr[i + 1] === '¹') {
        name += '⁻¹';
        i += 2;
      }
      if (!(name in FUNCTIONS)) throw new Error('Unknown function: ' + name);
      tokens.push({ type: 'function', value: name });
      continue;
    }

    if (ch in OPERATORS) { tokens.push({ type: 'operator', value: ch }); i++; continue; }
    if (ch === '(')       { tokens.push({ type: 'lparen' }); i++; continue; }
    if (ch === ')')       { tokens.push({ type: 'rparen' }); i++; continue; }

    throw new Error('Unexpected character: ' + ch);
  }

  return tokens;
}

/**
 * Insert a synthetic 0 before any unary minus so the shunting-yard
 * algorithm sees it as binary subtraction from zero.
 * E.g.: [-3] → [0, -, 3]   and   [(-, 5)] → [(, 0, -, 5, )]
 */
function handleUnaryMinus(tokens) {
  const result = [];
  for (const tok of tokens) {
    if (
      tok.type === 'operator' && tok.value === '-' &&
      (!result.length ||
       result[result.length - 1].type === 'operator' ||
       result[result.length - 1].type === 'lparen')
    ) {
      result.push({ type: 'number', value: 0 });
    }
    result.push(tok);
  }
  return result;
}

/** Shunting-yard: convert infix token array to RPN output queue. */
function shuntingYard(tokens) {
  const output  = [];
  const opStack = [];

  for (const tok of tokens) {
    switch (tok.type) {

      case 'number':
        output.push(tok);
        break;

      case 'function':
        opStack.push(tok);
        break;

      case 'operator': {
        const op = OPERATORS[tok.value];
        while (opStack.length > 0) {
          const top = opStack[opStack.length - 1];
          if (top.type === 'lparen') break;
          if (top.type === 'function') { output.push(opStack.pop()); continue; }
          if (top.type === 'operator') {
            const topOp = OPERATORS[top.value];
            if (topOp.prec > op.prec ||
                (topOp.prec === op.prec && op.assoc === 'L')) {
              output.push(opStack.pop());
              continue;
            }
          }
          break;
        }
        opStack.push(tok);
        break;
      }

      case 'lparen':
        opStack.push(tok);
        break;

      case 'rparen': {
        while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'lparen') {
          output.push(opStack.pop());
        }
        if (!opStack.length) throw new Error('Mismatched parentheses');
        opStack.pop(); // discard lparen
        if (opStack.length > 0 && opStack[opStack.length - 1].type === 'function') {
          output.push(opStack.pop());
        }
        break;
      }
    }
  }

  while (opStack.length > 0) {
    const tok = opStack.pop();
    if (tok.type === 'lparen') throw new Error('Mismatched parentheses');
    output.push(tok);
  }

  return output;
}

/** Evaluate an RPN queue and return a number. */
function evaluateRPN(rpn) {
  const stack = [];

  for (const tok of rpn) {
    if (tok.type === 'number') {
      stack.push(tok.value);

    } else if (tok.type === 'operator') {
      if (stack.length < 2) throw new Error('Invalid expression');
      const b = stack.pop();
      const a = stack.pop();
      stack.push(OPERATORS[tok.value].fn(a, b));

    } else if (tok.type === 'function') {
      const fn = FUNCTIONS[tok.value];
      if (!fn) throw new Error('Unknown function: ' + tok.value);
      if (stack.length < fn.args) throw new Error('Not enough arguments for ' + tok.value);
      const args = [];
      for (let i = 0; i < fn.args; i++) args.unshift(stack.pop());
      stack.push(fn.fn(...args));
    }
  }

  if (stack.length !== 1) throw new Error('Invalid expression');
  return stack[0];
}

/**
 * Public API: evaluate an expression string, return a number.
 * Throws a descriptive Error on any problem.
 */
function evaluate(exprStr) {
  const substituted = substituteConstants(exprStr.trim());
  if (!substituted) throw new Error('Empty expression');
  const tokens = handleUnaryMinus(tokenize(substituted));
  return evaluateRPN(shuntingYard(tokens));
}

/**
 * Format a result number for display.
 * Uses toPrecision(12) to suppress floating-point noise like 0.1+0.2 = 0.30000000000004.
 */
function formatResult(n) {
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
  if (isNaN(n))     return 'Error';
  return parseFloat(n.toPrecision(12)).toString();
}


// ============================================================
// === STATE
//
// All mutable app state lives here.
// state.degRad is unused in Phase 1 but consumed by the trig
// functions in the FUNCTIONS table in Phase 2.
// ============================================================

const HISTORY_KEY = 'calc_history';
const MAX_HISTORY = 10;

const state = {
  expr:        '',      // expression the user is building
  liveResult:  '',      // preview result (shown while typing)
  error:       '',      // error message after failed evaluation
  history:     [],      // [{ expr, result }, ...], newest first
  historyOpen: false,
  degRad:      'deg',   // 'deg' | 'rad' — used in Phase 2 by trig functions
  shift:       false,   // true when SHIFT mode is active
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    state.history = raw ? JSON.parse(raw) : [];
  } catch {
    state.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(state.history.slice(0, MAX_HISTORY))
    );
  } catch { /* storage unavailable — continue silently */ }
}

function pushHistory(expr, result) {
  state.history.unshift({ expr, result });
  if (state.history.length > MAX_HISTORY) state.history.pop();
  saveHistory();
}


// ============================================================
// === BUTTON LAYOUT
//
// TOP_ROWS:    6 rows × 4 cols — smaller scientific buttons
// BOTTOM_ROWS: 4 rows × 5 cols — larger main buttons
//
// Button shape: { label, action, type }
//   type: 'digit' | 'operator' | 'paren' | 'control' | 'equals'
//         'fn' | 'constant' | 'mode'
//   action: string appended to expr, OR special keyword:
//           'clear' | 'backspace' | 'evaluate' | 'noop'
// ============================================================

// Top panel — 4 rows × 6 columns of smaller scientific buttons
const TOP_ROWS = [
  [
    { label: 'SHIFT', action: 'shift',  type: 'mode'     },
    { label: 'ALPHA', action: 'noop',  type: 'mode'     },
    { label: 'DEG',  action: 'toggleDegRad',  type: 'mode'     },
    { label: 'x⁻¹',  action: '⁻¹',  type: 'fn'       },
    { label: 'x²',   action: '²',  type: 'fn'       },
    { label: 'x³',   action: '³',  type: 'fn'       },
  ],
  [
    { label: '^',    action: '^',  type: 'operator'  },
    { label: '√',    action: '√(',  type: 'fn'       },
    { label: 'sin',  action: 'sin(',  type: 'fn',   shiftLabel: 'sin⁻¹', shiftAction: 'sin⁻¹(' },
    { label: 'cos',  action: 'cos(',  type: 'fn',   shiftLabel: 'cos⁻¹', shiftAction: 'cos⁻¹(' },
    { label: 'tan',  action: 'tan(',  type: 'fn',   shiftLabel: 'tan⁻¹', shiftAction: 'tan⁻¹(' },
    { label: 'log',  action: 'noop',  type: 'fn'       },
  ],
  [
    { label: 'ln',   action: 'noop',  type: 'fn'       },
    { label: '(',    action: '(',     type: 'paren'    },
    { label: ')',    action: ')',     type: 'paren'    },
    { label: 'π',    action: 'π',     type: 'constant' },
    { label: '(−)',  action: 'negate', type: 'fn'       },
    { label: 'x!',   action: 'noop',  type: 'fn'       },
  ],
  [
    { label: 'nPr',  action: 'noop',  type: 'fn'       },
    { label: 'nCr',  action: 'noop',  type: 'fn'       },
    { label: 'RCL',  action: 'noop',  type: 'mode'     },
    { label: 'STO',  action: 'noop',  type: 'mode'     },
    { label: 'ENG',  action: 'noop',  type: 'mode'     },
    { label: '°\'"', action: 'noop',  type: 'fn'       },
  ],
];

// Bottom panel — 4 rows × 5 columns of larger main buttons
const BOTTOM_ROWS = [
  [
    { label: '7',   action: '7',        type: 'digit',    superLabel: 'T', shiftAction: 'T' },
    { label: '8',   action: '8',        type: 'digit'    },
    { label: '9',   action: '9',        type: 'digit'    },
    { label: 'DEL', action: 'backspace', type: 'control'  },
    { label: 'AC',  action: 'clear',    type: 'control'  },
  ],
  [
    { label: '4',   action: '4',        type: 'digit',    superLabel: 'k', shiftAction: 'k' },
    { label: '5',   action: '5',        type: 'digit',    superLabel: 'M', shiftAction: 'M' },
    { label: '6',   action: '6',        type: 'digit',    superLabel: 'G', shiftAction: 'G' },
    { label: '×',   action: '*',        type: 'operator' },
    { label: '÷',   action: '/',        type: 'operator' },
  ],
  [
    { label: '1',   action: '1',        type: 'digit',    superLabel: 'n', shiftAction: 'n' },
    { label: '2',   action: '2',        type: 'digit',    superLabel: 'μ', shiftAction: 'μ' },
    { label: '3',   action: '3',        type: 'digit',    superLabel: 'm', shiftAction: 'm' },
    { label: '+',   action: '+',        type: 'operator' },
    { label: '−',   action: '-',        type: 'operator' },
  ],
  [
    { label: '0',   action: '0',        type: 'digit',    superLabel: 'a', shiftAction: 'a' },
    { label: '.',   action: '.',        type: 'digit',    superLabel: 'f', shiftAction: 'f' },
    { label: 'EXP', action: 'noop',     type: 'fn',       superLabel: 'p', shiftAction: 'p' },
    { label: 'ANS', action: 'noop',     type: 'mode'     },
    { label: '=',   action: 'evaluate', type: 'equals'   },
  ],
];


// ============================================================
// === UI
// ============================================================

const $ = (id) => document.getElementById(id);

/** Populate a grid element from a rows array. */
function renderGrid(containerEl, rows) {
  containerEl.innerHTML = '';
  const cols = Math.max(...rows.map((row) => row.length));
  containerEl.style.setProperty('--cols', cols);
  containerEl.style.setProperty('--rows', rows.length);
  for (const row of rows) {
    for (const btn of row) {
      const el = document.createElement('button');
      el.className   = `btn btn--${btn.type}`;
      if (state.shift && (btn.shiftLabel || btn.shiftAction)) {
        el.textContent = btn.shiftLabel || btn.label;
        el.dataset.action = btn.shiftAction || 'noop';
      } else {
        el.textContent = btn.label;
        el.dataset.action = btn.action;
      }
      if (btn.superLabel) {
        const sup = document.createElement('span');
        sup.className = 'btn__super';
        sup.textContent = btn.superLabel;
        el.prepend(sup);
      }
      el.setAttribute('aria-label', btn.label);
      el.addEventListener('click', onButtonClick, { passive: true });
      containerEl.appendChild(el);
    }
  }
}

/** Render top (scientific) and bottom (main) keypads. */
function renderButtons() {
  renderGrid($('keypadTop'),    TOP_ROWS);
  renderGrid($('keypadBottom'), BOTTOM_ROWS);
}

/** Sync the display DOM to current state. */
function updateDisplay() {
  const exprEl   = $('exprDisplay');
  const resultEl = $('resultDisplay');

  exprEl.textContent = state.expr || '0';

  if (state.error) {
    resultEl.textContent = state.error;
    resultEl.className   = 'display__result display__result--error';
  } else if (state.liveResult !== '') {
    resultEl.textContent = '= ' + state.liveResult;
    resultEl.className   = 'display__result display__result--preview';
  } else {
    resultEl.textContent = '';
    resultEl.className   = 'display__result';
  }

  // SHIFT indicator
  $('shiftIndicator').style.display = state.shift ? 'inline' : 'none';
}

/** Rebuild the history list in the panel. */
function updateHistoryPanel() {
  const list = $('historyList');
  list.innerHTML = '';

  if (state.history.length === 0) {
    const li   = document.createElement('li');
    li.className = 'history-item history-item--empty';
    li.textContent = 'No history yet';
    list.appendChild(li);
    return;
  }

  for (const entry of state.history) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const expr   = document.createElement('span');
    expr.className   = 'history-item__expr';
    expr.textContent = entry.expr;

    const result = document.createElement('span');
    result.className   = 'history-item__result';
    result.textContent = '= ' + entry.result;

    li.appendChild(expr);
    li.appendChild(result);

    // Tap to paste result back into expression
    li.addEventListener('click', () => {
      state.expr  = entry.result;
      state.error = '';
      computeLiveResult();
      updateDisplay();
    }, { passive: true });

    list.appendChild(li);
  }
}

function setHistoryOpen(open) {
  state.historyOpen = open;
  const panel = $('historyPanel');
  const arrow = $('historyArrow');
  panel.classList.toggle('open', open);
  arrow.textContent = open ? '▴' : '▾';
  if (open) updateHistoryPanel();
}

/**
 * Attempt a silent live evaluation preview.
 * Errors are suppressed — the user is likely mid-expression.
 */
/** Auto-close unclosed parentheses so `sin(90` becomes `sin(90)`. */
function autoCloseParens(expr) {
  const opens = (expr.match(/\(/g) || []).length;
  const closes = (expr.match(/\)/g) || []).length;
  return expr + ')'.repeat(Math.max(0, opens - closes));
}

function computeLiveResult() {
  state.liveResult = '';
  state.error      = '';
  const expr = state.expr.trim();
  if (!expr) return;
  try {
    const closed    = autoCloseParens(expr);
    const result    = evaluate(closed);
    const formatted = formatResult(result);
    // Don't echo the same value (happens right after '=' is pressed)
    if (formatted !== state.expr) {
      state.liveResult = formatted;
    }
  } catch {
    // Silently swallow — incomplete expression is expected while typing
  }
}

function onButtonClick(e) {
  handleAction(e.currentTarget.dataset.action);
}

/** Central dispatcher — the only place that mutates state. */
function handleAction(action) {
  switch (action) {

    case 'clear':
      state.expr        = '';
      state.liveResult  = '';
      state.error       = '';
      break;

    case 'backspace':
      if (state.expr.length > 0) {
        state.expr = state.expr.slice(0, -1);
        state.error = '';
        computeLiveResult();
      }
      break;

    case 'evaluate': {
      if (!state.expr.trim()) break;
      try {
        const closed    = autoCloseParens(state.expr);
        const result    = evaluate(closed);
        const formatted = formatResult(result);
        pushHistory(state.expr, formatted);
        if (state.historyOpen) updateHistoryPanel();
        state.expr       = formatted;
        state.liveResult = '';
        state.error      = '';
      } catch (err) {
        state.error      = err.message || 'Error';
        state.liveResult = '';
      }
      break;
    }

    case 'toggleDegRad':
      state.degRad = state.degRad === 'deg' ? 'rad' : 'deg';
      // Update the MODE button label to reflect current angle unit
      const modeBtn = document.querySelector('[data-action="toggleDegRad"]');
      if (modeBtn) modeBtn.textContent = state.degRad.toUpperCase();
      computeLiveResult();
      break;

    case 'negate':
      state.expr += '-';
      state.error = '';
      computeLiveResult();
      break;

    case 'shift':
      state.shift = !state.shift;
      renderButtons();
      updateDisplay();
      break;

    case 'noop':
      break; // placeholder — no-op for unimplemented buttons

    default:
      // Append operator / digit / parenthesis to expression
      state.expr  += action;
      state.error  = '';
      computeLiveResult();
      break;
  }

  // Exit shift mode after any non-shift button press
  if (action !== 'shift' && state.shift) {
    state.shift = false;
    renderButtons();
  }

  updateDisplay();
}

/** Physical keyboard support (handy for desktop testing). */
function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;  // don't hijack shortcuts
  const k = e.key;
  if (/^[0-9]$/.test(k))                { handleAction(k);          return; }
  if (k === '.')                         { handleAction('.');         return; }
  if (k === '+')                         { handleAction('+');         return; }
  if (k === '-')                         { handleAction('-');         return; }
  if (k === '*')                         { handleAction('*');         return; }
  if (k === '/')                         { e.preventDefault(); handleAction('/'); return; }
  if (k === '(')                         { handleAction('(');         return; }
  if (k === ')')                         { handleAction(')');         return; }
  if (k === 'Enter' || k === '=')        { handleAction('evaluate');  return; }
  if (k === 'Backspace')                 { handleAction('backspace'); return; }
  if (k === 'Escape' || k === 'Delete')  { handleAction('clear');     return; }
}


// ============================================================
// === INIT
// ============================================================

function init() {
  loadHistory();
  renderButtons();
  updateDisplay();

  $('historyToggle').addEventListener('click', () => {
    setHistoryOpen(!state.historyOpen);
  }, { passive: true });

  document.addEventListener('keydown', onKeyDown);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Registration failed (e.g. opened via file://).
      // App continues to work, just without offline support.
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
