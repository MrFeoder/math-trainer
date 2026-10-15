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

test('buildPool: прямой формат — по одному вопросу на число', () => {
  const pool = MT.buildPool('square', 5, 7, 'direct');
  assert.equal(pool.length, 3);
  assert.deepEqual(pool.map(q => q.n), [5, 6, 7]);
  assert.ok(pool.every(q => q.format === 'direct' && q.kind === 'square'));
  const q7 = pool.find(q => q.n === 7);
  assert.equal(q7.prompt, '7² = ?');
  assert.equal(q7.answer, 49);
});

test('buildPool: кубы 1..10 и формулировка с кубом', () => {
  const pool = MT.buildPool('cube', 1, 10, 'direct');
  assert.equal(pool.length, 10);
  const q3 = pool.find(q => q.n === 3);
  assert.equal(q3.prompt, '3³ = ?');
  assert.equal(q3.answer, 27);
});

test('buildPool: обратный формат — спрашивается основание', () => {
  const pool = MT.buildPool('square', 7, 7, 'reverse');
  assert.equal(pool.length, 1);
  assert.equal(pool[0].prompt, '49 = ?²');
  assert.equal(pool[0].answer, 7);
  assert.equal(pool[0].format, 'reverse');
});

test('buildPool: смешанный — оба формата на каждое число', () => {
  const pool = MT.buildPool('cube', 2, 4, 'mixed');
  assert.equal(pool.length, 6);
  for (const n of [2, 3, 4]) {
    assert.equal(pool.filter(q => q.n === n && q.format === 'direct').length, 1);
    assert.equal(pool.filter(q => q.n === n && q.format === 'reverse').length, 1);
  }
  const rev = pool.find(q => q.n === 2 && q.format === 'reverse');
  assert.equal(rev.prompt, '8 = ?³');
  assert.equal(rev.answer, 2);
});

test('buildPool: вырожденный диапазон 1..1 и 20..20', () => {
  assert.equal(MT.buildPool('square', 1, 1, 'mixed').length, 2);
  assert.equal(MT.buildPool('square', 20, 20, 'direct').length, 1);
});

test('shuffle: возвращает новый массив с теми же элементами', () => {
  const src = [1, 2, 3, 4, 5];
  const out = MT.shuffle(src);
  assert.notEqual(out, src);
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test('nextQuestion: не повторяет вопросы, пока пул не исчерпан', () => {
  const pool = MT.buildPool('square', 1, 3, 'direct');
  let used = [];
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const { question, exhausted } = MT.nextQuestion(pool, used, used[used.length - 1]);
    used.push(MT.questionKey(question));
    seen.push(MT.questionKey(question));
    assert.equal(exhausted, false);
  }
  assert.deepEqual([...seen].sort(), ['direct:1', 'direct:2', 'direct:3']);
});

test('nextQuestion: после исчерпания пула сообщает exhausted и не повторяет предыдущий', () => {
  const pool = MT.buildPool('square', 1, 2, 'direct');
  const used = ['direct:1', 'direct:2'];
  const { question, exhausted } = MT.nextQuestion(pool, used, 'direct:2');
  assert.equal(exhausted, true);
  assert.equal(MT.questionKey(question), 'direct:1');
});

test('nextQuestion: пул из одного вопроса не зацикливается (диапазон 20..20)', () => {
  const pool = MT.buildPool('square', 20, 20, 'direct');
  for (let i = 0; i < 5; i++) {
    const { question } = MT.nextQuestion(pool, ['direct:20'], 'direct:20');
    assert.equal(question.n, 20);
  }
});

test('nextQuestion: каждый вопрос пула рано или поздно выдаётся (раунд длиннее пула)', () => {
  const pool = MT.buildPool('cube', 1, 3, 'direct');
  let used = [];
  let lastKey = null;
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const { question, exhausted } = MT.nextQuestion(pool, used, lastKey);
    const key = MT.questionKey(question);
    if (exhausted) used = [key]; else used.push(key);
    lastKey = key;
    seen.add(key);
  }
  assert.equal(seen.size, 3);
});
