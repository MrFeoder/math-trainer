const test = require('node:test');
const assert = require('node:assert/strict');
const MT = require('../logic.js');

const base = { kind: 'square', profile: 'kid', from: 1, to: 20, format: 'mixed', answerType: 'input', roundLength: 10 };

test('validateSettings: принимает корректные настройки', () => {
  const r = MT.validateSettings(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('validateSettings: принимает числовые строки из полей формы', () => {
  const r = MT.validateSettings({ ...base, from: '20', to: '20', roundLength: '7' });
  assert.equal(r.ok, true);
});

test('validateSettings: ловит пустое и нечисловое «От»', () => {
  for (const from of ['', '  ', 'ab', null, undefined, NaN]) {
    const r = MT.validateSettings({ ...base, from });
    assert.equal(r.ok, false, `from=${String(from)}`);
    assert.ok(r.errors.some(m => m.includes('От')), `from=${String(from)}: ${r.errors}`);
  }
});

test('validateSettings: ловит дробное, ноль, отрицательное и больше 100', () => {
  for (const from of ['1.5', 0, -5, 101, '999']) {
    const r = MT.validateSettings({ ...base, from });
    assert.equal(r.ok, false, `from=${String(from)}`);
  }
});

test('validateSettings: ловит «От» больше «До»', () => {
  const r = MT.validateSettings({ ...base, from: 20, to: 5 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(m => m.includes('больше')));
});

test('validateSettings: ловит плохие format, answerType, kind и roundLength', () => {
  assert.equal(MT.validateSettings({ ...base, format: 'zzz' }).ok, false);
  assert.equal(MT.validateSettings({ ...base, answerType: 'zzz' }).ok, false);
  assert.equal(MT.validateSettings({ ...base, kind: 'zzz' }).ok, false);
  assert.equal(MT.validateSettings({ ...base, roundLength: 0 }).ok, false);
});

test('validateSettings: from=1 to=1 и from=100 to=100 валидны', () => {
  assert.equal(MT.validateSettings({ ...base, from: 1, to: 1 }).ok, true);
  assert.equal(MT.validateSettings({ ...base, from: 100, to: 100 }).ok, true);
});

test('validateSettings: предупреждает про большие числа, но не блокирует', () => {
  const r = MT.validateSettings({ ...base, from: 50, to: 60 });
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
  assert.equal(MT.validateSettings({ ...base, from: 49, to: 60 }).warnings.length, 0);
});

test('defaultsFor: диапазоны по умолчанию для квадратов и кубов', () => {
  assert.deepEqual(MT.defaultsFor('square'), { ...base, kind: 'square', from: 1, to: 20 });
  assert.deepEqual(MT.defaultsFor('cube'), { ...base, kind: 'cube', from: 1, to: 10 });
});

test('applyProfile: подставляет диапазон профиля, прочие поля не трогает', () => {
  const s = MT.applyProfile({ ...base, format: 'direct' }, 'adult');
  assert.equal(s.profile, 'adult');
  assert.equal(s.from, 1);
  assert.equal(s.to, 30);
  assert.equal(s.format, 'direct');
});

test('normalizeSettings: мусор заменяется умолчаниями, валидные поля остаются', () => {
  const s = MT.normalizeSettings({ from: '7', to: 'мусор', format: 'direct', answerType: 'choice', roundLength: 3.5 }, 'cube');
  assert.equal(s.from, 7);
  assert.equal(s.to, 10);
  assert.equal(s.format, 'direct');
  assert.equal(s.answerType, 'choice');
  assert.equal(s.roundLength, 10);
  assert.equal(s.kind, 'cube');
  assert.equal(MT.normalizeSettings(null, 'square').to, 20);
});
