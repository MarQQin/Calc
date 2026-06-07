'use strict';
(function() {

// ============================================================
// === CALC ENGINE — pure math, no DOM, no localStorage
//
// Wrapped in IIFE so nothing leaks to global scope.
// Works in both browser (window.calcEngine) and Node (module.exports).
// ============================================================

/**
 * Operator table.
 * prec: precedence (higher = binds tighter)
 * assoc: 'L' (left) or 'R' (right)
 * fn: (a, b) -> number
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
 * Build function table for a given angle mode.
 */
function buildFunctions(degRad) {
  return {
    sin: { args: 1, fn: (x) => Math.sin(degRad === 'deg' ? x * Math.PI / 180 : x) },
    cos: { args: 1, fn: (x) => Math.cos(degRad === 'deg' ? x * Math.PI / 180 : x) },
    tan: { args: 1, fn: (x) => Math.tan(degRad === 'deg' ? x * Math.PI / 180 : x) },
    'sin⁻¹': { args: 1, fn: (x) => {
      if (x < -1 || x > 1) throw new Error('sin⁻¹ domain error');
      const r = Math.asin(x);
      return degRad === 'deg' ? r * 180 / Math.PI : r;
    }},
    'cos⁻¹': { args: 1, fn: (x) => {
      if (x < -1 || x > 1) throw new Error('cos⁻¹ domain error');
      const r = Math.acos(x);
      return degRad === 'deg' ? r * 180 / Math.PI : r;
    }},
    'tan⁻¹': { args: 1, fn: (x) => {
      const r = Math.atan(x);
      return degRad === 'deg' ? r * 180 / Math.PI : r;
    }},
    '√': { args: 1, fn: (x) => {
      if (x < 0) throw new Error('√ domain error');
      return Math.sqrt(x);
    }},
    'neg': { args: 1, fn: (x) => -x },
  };
}

/** Active function table — set by evaluate() before use. */
let _FUNCTIONS;

/**
 * Constants substituted as text before tokenizing.
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
      if (!(name in _FUNCTIONS)) throw new Error('Unknown function: ' + name);
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
 * Convert any unary minus into a 'neg' function call so the
 * shunting-yard handles it correctly regardless of precedence.
 * E.g.: -3 → neg(3)   and   3*-2 → 3*neg(2)
 */
function handleUnaryMinus(tokens) {
  const result = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (
      tok.type === 'operator' && tok.value === '-' &&
      (!result.length ||
       result[result.length - 1].type === 'operator' ||
       result[result.length - 1].type === 'lparen')
    ) {
      result.push({ type: 'function', value: 'neg' });
      result.push({ type: 'lparen' });

      const next = tokens[i + 1];
      if (!next) throw new Error('Unexpected end of expression');

      if (next.type === 'number') {
        result.push(next);
        result.push({ type: 'rparen' });
        i++; // consume the number
      } else {
        // Parenthesised expression or function call: scan to matching )
        let depth = 0;
        let j = i + 1;
        for (; j < tokens.length; j++) {
          result.push(tokens[j]);
          if (tokens[j].type === 'lparen') depth++;
          if (tokens[j].type === 'rparen') {
            depth--;
            if (depth === 0) break;
          }
        }
        if (depth !== 0) throw new Error('Mismatched parentheses');
        result.push({ type: 'rparen' });
        i = j; // skip past consumed tokens
      }
      continue;
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
      const fn = _FUNCTIONS[tok.value];
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
 *
 * @param {string} exprStr - The expression to evaluate
 * @param {string} degRad - 'deg' or 'rad' for trig functions
 */
function evaluate(exprStr, degRad) {
  _FUNCTIONS = buildFunctions(degRad || 'deg');
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
  if (isNaN(n))     return 'Error';
  if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
  return parseFloat(n.toPrecision(12)).toString();
}

// Export for both environments
if (typeof window !== 'undefined') {
  window.calcEngine = { evaluate, formatResult };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { evaluate, formatResult };
}

})();
