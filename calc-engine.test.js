'use strict';

// ============================================================
// calc-engine.test.js — zero-dependency tests using Node built-in test runner
// Run:  node --test calc-engine.test.js
// ============================================================

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, formatResult } = require('./calc-engine.js');

// ── Basic arithmetic ──────────────────────────────────────────

describe('evaluate — basic arithmetic', () => {
  it('adds 2+2',        () => assert.equal(evaluate('2+2'), 4));
  it('subtracts 10-3',   () => assert.equal(evaluate('10-3'), 7));
  it('multiplies 6*7',   () => assert.equal(evaluate('6*7'), 42));
  it('divides 15/3',     () => assert.equal(evaluate('15/3'), 5));
  it('handles decimals', () => assert.ok(Math.abs(evaluate('0.1+0.2') - 0.3) < 1e-10));
});

// ── Precedence & grouping ────────────────────────────────────

describe('evaluate — precedence & grouping', () => {
  it('respects * over +',       () => assert.equal(evaluate('2+3*4'), 14));
  it('respects * over -',       () => assert.equal(evaluate('10-3*2'), 4));
  it('parentheses override',    () => assert.equal(evaluate('(2+3)*4'), 20));
  it('nested parentheses',      () => assert.equal(evaluate('((1+2))*3'), 9));
  it('complex expression',      () => assert.equal(evaluate('2*(3+4)-8/2'), 10));
});

// ── Power & special operators ────────────────────────────────

describe('evaluate — power & special', () => {
  it('2^10 = 1024',             () => assert.equal(evaluate('2^10'), 1024));
  it('3^2 = 9',                 () => assert.equal(evaluate('3^2'), 9));
  it('right-associative 2^3^2', () => assert.equal(evaluate('2^3^2'), 512)); // 2^(3^2) = 2^9
  it('x² via superscript',      () => assert.equal(evaluate('5²'), 25));
  it('x³ via superscript',      () => assert.equal(evaluate('2³'), 8));
});

// ── Unary minus ──────────────────────────────────────────────

describe('evaluate — unary minus', () => {
  it('-5+10',        () => assert.equal(evaluate('-5+10'), 5));
  it('-(3+2)',       () => assert.equal(evaluate('-(3+2)'), -5));
  it('3*-2',         () => assert.equal(evaluate('3*-2'), -6));
});

// ── Functions ────────────────────────────────────────────────

describe('evaluate — trig functions (degrees)', () => {
  it('sin(0) = 0',               () => assert.ok(Math.abs(evaluate('sin(0)', 'deg') - 0) < 1e-10));
  it('sin(90) = 1',              () => assert.ok(Math.abs(evaluate('sin(90)', 'deg') - 1) < 1e-10));
  it('cos(0) = 1',               () => assert.ok(Math.abs(evaluate('cos(0)', 'deg') - 1) < 1e-10));
  it('cos(180) = -1',            () => assert.ok(Math.abs(evaluate('cos(180)', 'deg') + 1) < 1e-10));
  it('tan(45) = 1',              () => assert.ok(Math.abs(evaluate('tan(45)', 'deg') - 1) < 1e-10));
});

describe('evaluate — trig functions (radians)', () => {
  it('sin(π/2) ≈ 1',            () => assert.ok(Math.abs(evaluate('sin(1.5707963267948966)', 'rad') - 1) < 1e-10));
  it('cos(0) = 1',               () => assert.ok(Math.abs(evaluate('cos(0)', 'rad') - 1) < 1e-10));
});

describe('evaluate — inverse trig', () => {
  it('sin⁻¹(1) = 90°',          () => assert.ok(Math.abs(evaluate('sin⁻¹(1)', 'deg') - 90) < 1e-10));
  it('cos⁻¹(0.5) = 60°',        () => assert.ok(Math.abs(evaluate('cos⁻¹(0.5)', 'deg') - 60) < 1e-10));
  it('tan⁻¹(1) = 45°',          () => assert.ok(Math.abs(evaluate('tan⁻¹(1)', 'deg') - 45) < 1e-10));
});

describe('evaluate — √', () => {
  it('√(16) = 4',                () => assert.equal(evaluate('√(16)'), 4));
  it('√(2) ≈ 1.4142',           () => assert.ok(Math.abs(evaluate('√(2)') - Math.SQRT2) < 1e-10));
  it('√(0) = 0',                 () => assert.equal(evaluate('√(0)'), 0));
});

// ── Engineering prefixes ─────────────────────────────────────

describe('evaluate — engineering prefixes', () => {
  it('1k = 1000',     () => assert.equal(evaluate('1k'), 1000));
  it('1M = 1000000',  () => assert.equal(evaluate('1M'), 1000000));
  it('1m = 0.001',    () => assert.equal(evaluate('1m'), 0.001));
  it('1u = 0.000001', () => assert.equal(evaluate('1u'), 0.000001));
  it('1n = 1e-9',     () => assert.equal(evaluate('1n'), 1e-9));
  it('1p = 1e-12',    () => assert.equal(evaluate('1p'), 1e-12));
  it('1k+1k = 2000',  () => assert.equal(evaluate('1k+1k'), 2000));
});

// ── Pi constant ──────────────────────────────────────────────

describe('evaluate — π constant', () => {
  it('π ≈ 3.14159265359',        () => assert.ok(Math.abs(evaluate('π') - Math.PI) < 1e-10));
  it('2*π ≈ 6.28318530718',     () => assert.ok(Math.abs(evaluate('2*π') - 2 * Math.PI) < 1e-10));
  it('π² ≈ 9.8696',             () => assert.ok(Math.abs(evaluate('π²') - Math.PI ** 2) < 1e-6));
});

// ── Error cases ──────────────────────────────────────────────

// ── Physics constants ─────────────────────────────────────

const PHYSICS_CONSTANTS = require('./calc-engine.js').PHYSICS_CONSTANTS;

describe('evaluate — physics constants', () => {
  it('c = speed of light',         () => assert.equal(evaluate('c'), 299792458));
  it('h = Planck constant',        () => assert.ok(Math.abs(evaluate('h') - 6.62607015e-34) < 1e-43));
  it('e = elementary charge',      () => assert.ok(Math.abs(evaluate('e') - 1.602176634e-19) < 1e-29));
  it('k = Boltzmann constant',     () => assert.ok(Math.abs(evaluate('k') - 1.380649e-23) < 1e-33));
  it('ℏ = reduced Planck const',   () => assert.ok(Math.abs(evaluate('\u210F') - 1.054571817e-34) < 1e-44));
  it('α = fine-structure const',   () => assert.ok(Math.abs(evaluate('\u03B1') - 7.2973525693e-3) < 1e-13));
  it('σ = Stefan-Boltzmann',       () => assert.ok(Math.abs(evaluate('\u03C3') - 5.670374419e-8) < 1e-18));
  it('ε₀ = vacuum permittivity',   () => assert.ok(Math.abs(evaluate('\u03B5\u2080') - 8.8541878128e-12) < 1e-22));
  it('μ₀ = vacuum permeability',   () => assert.ok(Math.abs(evaluate('\u03BC\u2080') - 1.25663706212e-6) < 1e-16));
  it('mₑ = electron mass',         () => assert.ok(Math.abs(evaluate('m\u2091') - 9.1093837015e-31) < 1e-41));
  it('mₚ = proton mass',           () => assert.ok(Math.abs(evaluate('m\u209A') - 1.67262192369e-27) < 1e-37));
  it('Nₐ = Avogadro constant',     () => assert.ok(Math.abs(evaluate('N\u2090') - 6.02214076e23) < 1e13));
  it('Z₀ = impedance free space',  () => assert.ok(Math.abs(evaluate('Z\u2080') - 376.730313668) < 1e-6));
  it('G = gravitational const',    () => assert.ok(Math.abs(evaluate('G') - 6.67430e-11) < 1e-15));
});

describe('evaluate — physics constants: implicit multiplication', () => {
  it('2π still works',             () => assert.ok(Math.abs(evaluate('2π') - 2 * Math.PI) < 1e-10));
  it('2c = 2×speed of light',      () => assert.equal(evaluate('2c'), 599584916));
  it('5k after number = prefix',   () => assert.equal(evaluate('5k'), 5000));  // kilo prefix wins
  it('standalone k = Boltzmann',   () => assert.ok(Math.abs(evaluate('k') - 1.380649e-23) < 1e-33));
  it('5G after number = prefix',   () => assert.equal(evaluate('5G'), 5e9));  // giga prefix wins
  it('standalone G = gravitational', () => assert.ok(Math.abs(evaluate('G') - 6.67430e-11) < 1e-15));
  it('c*c = c²',                   () => assert.ok(Math.abs(evaluate('c*c') - 299792458 ** 2) < 1e15));
  it('2*c+3',                      () => assert.equal(evaluate('2*c+3'), 599584919));
});

describe('evaluate — physics constants: functions still work', () => {
  it('sin(90) unchanged',          () => assert.ok(Math.abs(evaluate('sin(90)', 'deg') - 1) < 1e-10));
  it('cos(0) unchanged',           () => assert.ok(Math.abs(evaluate('cos(0)', 'deg') - 1) < 1e-10));
  it('√(c) works',                 () => assert.ok(Math.abs(evaluate('√(c)') - Math.sqrt(299792458)) < 1));
});

describe('evaluate — errors', () => {
  it('division by zero throws',       () => assert.throws(() => evaluate('1/0'), /Division by zero/));
  it('empty expression throws',       () => assert.throws(() => evaluate(''), /Empty/));
  it('unknown function throws',       () => assert.throws(() => evaluate('foo(1)'), /Unknown function/));
  it('mismatched parens throws',      () => assert.throws(() => evaluate('(1+2'), /Mismatched parentheses/));
  it('√ of negative throws',          () => assert.throws(() => evaluate('√(-1)'), /√ domain error/));
  it('sin⁻¹ out of range throws',     () => assert.throws(() => evaluate('sin⁻¹(2)'), /sin⁻¹ domain error/));
});

// ── formatResult ─────────────────────────────────────────────

describe('formatResult', () => {
  it('suppresses 0.1+0.2 float noise', () => assert.equal(formatResult(0.1 + 0.2), '0.3'));
  it('Infinity → ∞',                   () => assert.equal(formatResult(Infinity), '∞'));
  it('-Infinity → -∞',                 () => assert.equal(formatResult(-Infinity), '-∞'));
  it('NaN → Error',                    () => assert.equal(formatResult(NaN), 'Error'));
  it('integer stays integer',          () => assert.equal(formatResult(42), '42'));
  it('large number',                   () => assert.equal(formatResult(1000000), '1000000'));
});
