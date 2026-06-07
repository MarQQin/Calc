'use strict';

// ============================================================
// === CALC APP — UI, state, button layout, event handling
//
// Depends on calc-engine.js loaded before this file.
// ============================================================

const { evaluate, formatResult, PHYSICS_CONSTANTS } = window.calcEngine;


// ============================================================
// === STATE
//
// All mutable app state lives here.
// state.degRad is consumed by the trig functions in calc-engine.js.
// ============================================================

const HISTORY_KEY = 'calc_history';
const MAX_HISTORY = 10;

const state = {
  expr:        '',      // expression the user is building
  liveResult:  '',      // preview result (shown while typing)
  error:       '',      // error message after failed evaluation
  history:     [],      // [{ expr, result }, ...], newest first
  historyOpen: false,  constantsOpen: false,  degRad:      'deg',   // 'deg' | 'rad' — used in Phase 2 by trig functions
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
    { label: 'ALPHA', action: 'openConstants',  type: 'mode'     },
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
/** Category definitions for grouping constants in the panel. */
const CONSTANT_CATEGORIES = [
  { name: 'Fundamental', keys: ['c', 'h', '\u03B1', 'G'] },
  { name: 'Quantum',     keys: ['\u210F'] },
  { name: 'EM',          keys: ['e', '\u03B5\u2080', '\u03BC\u2080', 'Z\u2080'] },
  { name: 'Thermo',      keys: ['k', '\u03C3', 'N\u2090'] },
  { name: 'Particle',    keys: ['m\u2091', 'm\u209A'] },
];

/** Pretty names for each constant symbol. */
const CONSTANT_NAMES = {
  'c': 'Speed of light', '\u210F': 'Reduced Planck const.', 'h': 'Planck constant',
  'e': 'Elementary charge', 'k': 'Boltzmann constant', '\u03C3': 'Stefan-Boltzmann const.',
  '\u03B1': 'Fine-structure const.', '\u03B5\u2080': 'Vacuum permittivity',
  '\u03BC\u2080': 'Vacuum permeability', 'G': 'Gravitational constant',
  'm\u2091': 'Electron mass', 'm\u209A': 'Proton mass',
  'N\u2090': 'Avogadro constant', 'Z\u2080': 'Impedance of free space',
};

/** Build the constants panel list. */
function renderConstantsPanel() {
  const list = $('constantsList');
  list.innerHTML = '';

  for (const cat of CONSTANT_CATEGORIES) {
    const header = document.createElement('div');
    header.className = 'constants-panel__category';
    header.textContent = cat.name;
    list.appendChild(header);

    for (const sym of cat.keys) {
      const val = PHYSICS_CONSTANTS[sym];
      if (val === undefined) continue;

      const row = document.createElement('div');
      row.className = 'constants-panel__row';

      const info = document.createElement('div');
      info.className = 'constants-panel__info';

      const symEl = document.createElement('span');
      symEl.className = 'constants-panel__symbol';
      symEl.textContent = sym;

      const nameEl = document.createElement('span');
      nameEl.className = 'constants-panel__name';
      nameEl.textContent = CONSTANT_NAMES[sym] || sym;

      info.appendChild(symEl);
      info.appendChild(nameEl);

      const actions = document.createElement('div');
      actions.className = 'constants-panel__actions';

      const symBtn = document.createElement('button');
      symBtn.className = 'constants-panel__btn constants-panel__btn--sym';
      symBtn.textContent = 'sym';
      symBtn.addEventListener('click', () => {
        insertConstantSymbol(sym);
      }, { passive: true });

      const valBtn = document.createElement('button');
      valBtn.className = 'constants-panel__btn constants-panel__btn--val';
      valBtn.textContent = '123';
      valBtn.addEventListener('click', () => {
        insertConstantValue(val);
      }, { passive: true });

      actions.appendChild(symBtn);
      actions.appendChild(valBtn);

      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    }
  }
}

function insertConstantSymbol(sym) {
  state.expr  += sym;
  state.error  = '';
  computeLiveResult();
  updateDisplay();
  setConstantsOpen(false);
}

function insertConstantValue(val) {
  // Format the value compactly
  const formatted = parseFloat(val.toPrecision(10)).toString();
  state.expr  += formatted;
  state.error  = '';
  computeLiveResult();
  updateDisplay();
  setConstantsOpen(false);
}

function setConstantsOpen(open) {
  state.constantsOpen = open;
  $('constantsPanel').classList.toggle('open', open);
  if (open) {
    renderConstantsPanel();
    // Close history if open
    if (state.historyOpen) setHistoryOpen(false);
  }
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
    const result    = evaluate(closed, state.degRad);
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
        // Check if expression ends with a multi-char physics constant symbol
        const syms = Object.keys(PHYSICS_CONSTANTS).sort((a, b) => b.length - a.length);
        let removed = false;
        for (const sym of syms) {
          if (sym.length > 1 && state.expr.endsWith(sym)) {
            state.expr = state.expr.slice(0, -sym.length);
            removed = true;
            break;
          }
        }
        if (!removed) {
          state.expr = state.expr.slice(0, -1);
        }
        state.error = '';
        computeLiveResult();
      }
      break;

    case 'evaluate': {
      if (!state.expr.trim()) break;
      try {
        const closed    = autoCloseParens(state.expr);
        const result    = evaluate(closed, state.degRad);
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
    case 'openConstants':
      setConstantsOpen(!state.constantsOpen);
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

  $('constantsClose').addEventListener('click', () => {
    setConstantsOpen(false);
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
