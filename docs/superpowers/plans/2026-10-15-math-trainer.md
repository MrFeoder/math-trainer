# Тренажёр «Квадраты и кубы» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Опубликованный на GitHub Pages статический сайт-тренажёр с двумя отдельными тренажёрами (квадраты, кубы), настраиваемым диапазоном чисел и двумя типами ответа (вписать / выбрать из вариантов).

**Architecture:** Одна статическая страница без сборки. Вся чистая логика (валидация настроек, генерация пула вопросов, варианты ответа, подсчёт итогов) — в `logic.js`, оформленном UMD-обёрткой: в браузере создаёт глобальный `MT`, в Node отдаётся через `module.exports` для тестов. `app.js` занимается только DOM, состоянием экранов и `localStorage`. Настройки и лучшие результаты хранятся в `localStorage` по ключам на тренажёр.

**Tech Stack:** HTML + CSS + ванильный JavaScript; обычные `<script>` (не ES-модули), чтобы работало по `file://`; тесты — встроенный раннер Node 24 (`node --test`), без внешних пакетов; публикация — GitHub CLI + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-math-trainer-design.md`

## Global Constraints

- Никакой сборки, никаких npm-зависимостей, никаких CDN и внешних шрифтов.
- Скрипты подключаются как обычные (`<script src="...">`), **не** `type="module"`.
- Порядок подключения в `index.html`: `styles.css` → `logic.js` → `app.js`.
- Весь текст интерфейса и все сообщения об ошибках — на русском языке.
- Диапазон чисел: целые от 1 до 100, «От» ≤ «До». Вопросов в раунде: целое от 1 до 100.
- Значения по умолчанию: квадраты 1–20, кубы 1–10; формат «смешанный», тип ответа «вписать», раунд 10.
- Предупреждение (не ошибка) показывается, если `from >= 50`: `Числа от 50: ответы будут очень большими`.
- Точные тексты ошибок: `«От»: нужно целое число от 1 до 100`, `«До»: нужно целое число от 1 до 100`, `«От» не может быть больше «До»`, `«Вопросов в раунде»: нужно целое число от 1 до 100`, `Неизвестный формат задания`, `Неизвестный тип ответа`, `Неизвестный тренажёр`.
- Ключи `localStorage`: `mt.settings.square`, `mt.settings.cube`, `mt.best.<kind>.<format>.<answerType>.<from>-<to>`, `mt.profile`.
- Проект существует только в `C:\Users\Фёдор\math-trainer` (репозиторий `MrFeoder/math-trainer`). Репозиторий и файлы `MrFeoder/besplatniy-sait` не изменяются ни на одном шаге.
- Node v24 доступен; `bun` не установлен — использовать только `node --test`.
- Переменные окружения и глобальный git-конфиг не меняются: автор коммитов задан локально в репозитории (`git config user.name MrFeoder`, `user.email 292224101+MrFeoder@users.noreply.github.com`).

## Review Focus

Пять классов входных данных/сбоев, которые spec подразумевает, но которые легко ломаются. Для каждой строки тест добавлен в задачу, владеющую кодом:

1. **Мусор в полях настроек** (пусто, `0`, `-5`, `1.5`, `ab`, `999`, «От» > «До», `localStorage` недоступен или с мусором) — показывается понятная ошибка, «Начать» заблокирована или подставляются умолчания; страница не падает и не пишет в консоль.
2. **Вырожденные диапазоны и раунд длиннее пула** (`1..1`, `20..20`, раунд 10 при пуле 1) — раунд проходит, вопросы повторяются, без зависаний и бесконечных циклов.
3. **Обратные вопросы в режиме выбора** (`49 = ?²`, `125 = ?³`) — верный вариант ровно один, дистракторы — соседние основания, без нулей и дубликатов.
4. **Быстрые повторные действия** (двойной клик по варианту, Enter + клик, ввод в неактивной фазе) — ответ засчитывается один раз, состояние не ломается.
5. **Числовое сравнение ответов** (`07` == `7`, `49` vs `94`, пустая строка) — совпадение только по значению, пустой ввод не засчитывается как ошибка на уровне UI.

---

### Task 1: `logic.js` — каркас, профили и валидация настроек

**Files:**
- Create: `logic.js`
- Create: `test/logic.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: глобальный/модульный объект `MT` с:
  - `MT.PROFILES` — `{ kid: { square: {from:1,to:20}, cube: {from:1,to:10} }, adult: { square: {from:1,to:30}, cube: {from:1,to:15} }, neutral: { square: {from:1,to:20}, cube: {from:1,to:12} } }`
  - `MT.defaultsFor(kind) -> Settings` — `{ kind, profile:'kid', from, to, format:'mixed', answerType:'input', roundLength:10 }`, диапазон по профилю `kid`;
  - `MT.applyProfile(settings, profile) -> Settings` — копия настроек с `profile` и диапазоном профиля;
  - `MT.validateSettings(settings) -> { ok: boolean, errors: string[], warnings: string[] }`;
  - `MT.normalizeSettings(raw, kind) -> Settings` — берёт валидные поля из `raw`, остальные из `defaultsFor(kind)`;
  - `MT.toInt(value) -> number|NaN` — `String(value).trim()`, затем `/^\d+$/` и `parseInt`.

- [ ] **Step 1: Написать падающие тесты в `test/logic.test.js`**

```js
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
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `node --test test/`
Expected: FAIL — `Cannot find module '../logic.js'`.

- [ ] **Step 3: Реализовать `logic.js`**

UMD-обёртка, чтобы файл работал и в браузере (глобальный `MT`), и в Node:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ... возвращает объект MT
});
```

Реализовать `PROFILES`, `defaultsFor`, `applyProfile`, `toInt`, `validateSettings`, `normalizeSettings`. Валидные значения `format`: `direct`, `reverse`, `mixed`; `answerType`: `input`, `choice`; `kind`: `square`, `cube`. Все тексты ошибок — строго из Global Constraints.

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `node --test test/`
Expected: PASS, все тесты зелёные.

- [ ] **Step 5: Коммит**

```bash
git add logic.js test/logic.test.js
git commit -m "feat: валидация настроек и профили тренажёра"
```

---

### Task 2: `logic.js` — пул вопросов и выбор следующего

**Files:**
- Modify: `logic.js`
- Modify: `test/logic.test.js`

**Interfaces:**
- Consumes: `MT.defaultsFor`, `MT.validateSettings` из Task 1.
- Produces:
  - `MT.questionKey(q) -> string` — `` `${q.format}:${q.n}` ``;
  - `MT.buildPool(kind, from, to, format) -> Question[]`, где `Question = { kind, n, format: 'direct'|'reverse', prompt: string, answer: number }`;
  - `MT.shuffle(array) -> array` — новая копия (Fisher–Yates);
  - `MT.nextQuestion(pool, usedKeys, lastKey) -> { question: Question, exhausted: boolean }`.
- Тексты: прямой — `` `${n}${kind === 'square' ? '²' : '³'} = ?` `` (например `7² = ?`, `3³ = ?`); обратный — `` `${value} = ?${kind === 'square' ? '²' : '³'}` `` (например `49 = ?²`, `125 = ?³`). `value` — `n*n` для квадратов, `n*n*n` для кубов. `answer` — `value` для прямого и `n` для обратного.

- [ ] **Step 1: Написать падающие тесты**

```js
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
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `node --test test/`
Expected: FAIL — `MT.buildPool is not a function`.

- [ ] **Step 3: Реализовать функции в `logic.js`**

- `buildPool`: для `direct`/`reverse` — по одному вопросу на каждое `n` из `from..to`; для `mixed` — сначала все прямые, затем все обратные (порядок не важен, итог перемешивается вызывающим).
- `shuffle`: Fisher–Yates по копии массива.
- `nextQuestion`: `available = pool.filter(q => !usedKeys.includes(key) && key !== lastKey)`. Если непусто — случайный из `available`, `exhausted: false`. Иначе `fallback = pool.filter(q => key !== lastKey || pool.length === 1)`; вернуть случайный из `fallback` (или `pool[0]`, если `fallback` пуст), `exhausted: true`.

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add logic.js test/logic.test.js
git commit -m "feat: генерация пула вопросов и выбор следующего"
```

---

### Task 3: `logic.js` — варианты ответа и проверка ответа

**Files:**
- Modify: `logic.js`
- Modify: `test/logic.test.js`

**Interfaces:**
- Consumes: `Question` из Task 2, `MT.shuffle`.
- Produces:
  - `MT.makeChoices(question, count = 4) -> number[]` — верный ответ + `count-1` дистракторов, все уникальны, все положительные, порядок перемешан;
  - `MT.checkAnswer(question, given) -> boolean` — `false`, если `given` пусто/`NaN`; иначе числовое сравнение с `question.answer`.

- [ ] **Step 1: Написать падающие тесты**

```js
const correctCount = (choices, answer) => choices.filter(c => c === answer).length;

test('makeChoices: прямой квадрат — 4 уникальных варианта, ровно один верный', () => {
  const q = MT.buildPool('square', 7, 7, 'direct')[0];
  const choices = MT.makeChoices(q);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.every(c => Number.isInteger(c) && c > 0));
  assert.equal(correctCount(choices, 49), 1);
});

test('makeChoices: прямой куб — верный вариант 27 присутствует', () => {
  const q = MT.buildPool('cube', 3, 3, 'direct')[0];
  const choices = MT.makeChoices(q);
  assert.equal(new Set(choices).size, 4);
  assert.equal(correctCount(choices, 27), 1);
});

test('makeChoices: обратный вопрос — дистракторы это соседние основания', () => {
  const q = MT.buildPool('square', 7, 7, 'reverse')[0];
  const choices = MT.makeChoices(q);
  assert.equal(new Set(choices).size, 4);
  assert.equal(correctCount(choices, 7), 1);
  assert.ok(choices.every(c => Math.abs(c - 7) <= 3), `варианты: ${choices}`);
});

test('makeChoices: n=1 в обратном вопросе не даёт нулей и дубликатов', () => {
  const q = MT.buildPool('square', 1, 1, 'reverse')[0];
  const choices = MT.makeChoices(q);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.every(c => c > 0), `варианты: ${choices}`);
  assert.equal(correctCount(choices, 1), 1);
});

test('makeChoices: n=1 в прямом вопросе (ответ 1)', () => {
  const q = MT.buildPool('cube', 1, 1, 'direct')[0];
  const choices = MT.makeChoices(q);
  assert.equal(new Set(choices).size, 4);
  assert.equal(correctCount(choices, 1), 1);
});

test('makeChoices: варианты всегда уникальны и содержат ответ (перебор диапазона)', () => {
  for (const kind of ['square', 'cube']) {
    for (const format of ['direct', 'reverse']) {
      for (let n = 1; n <= 30; n++) {
        const q = MT.buildPool(kind, n, n, format)[0];
        const choices = MT.makeChoices(q);
        assert.equal(choices.length, 4, `${kind} ${format} n=${n}`);
        assert.equal(new Set(choices).size, 4, `${kind} ${format} n=${n}: ${choices}`);
        assert.equal(correctCount(choices, q.answer), 1, `${kind} ${format} n=${n}: ${choices}`);
        assert.ok(choices.every(c => Number.isInteger(c) && c > 0), `${kind} ${format} n=${n}: ${choices}`);
      }
    }
  }
});

test('checkAnswer: числовое сравнение и мусор', () => {
  const q = MT.buildPool('square', 7, 7, 'direct')[0];
  assert.equal(MT.checkAnswer(q, '49'), true);
  assert.equal(MT.checkAnswer(q, 49), true);
  assert.equal(MT.checkAnswer(q, '49.0'), false);
  assert.equal(MT.checkAnswer(q, '07'), false);
  assert.equal(MT.checkAnswer(q, ''), false);
  assert.equal(MT.checkAnswer(q, 'ab'), false);
  assert.equal(MT.checkAnswer(q, null), false);
});

test('checkAnswer: ведущий ноль не мешает («07» равно 7)', () => {
  const q = MT.buildPool('square', 7, 7, 'reverse')[0];
  assert.equal(MT.checkAnswer(q, '07'), true);
  assert.equal(MT.checkAnswer(q, '7'), true);
});

test('checkAnswer: обратный вопрос и ноль', () => {
  const q = MT.buildPool('cube', 5, 5, 'reverse')[0];
  assert.equal(MT.checkAnswer(q, '5'), true);
  assert.equal(MT.checkAnswer(q, '0'), false);
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `node --test test/`
Expected: FAIL — `MT.makeChoices is not a function`.

- [ ] **Step 3: Реализовать функции в `logic.js`**

- `makeChoices(question, count = 4)`:
  - для прямого вопроса кандидаты: `[value + n, value - n, (n + 1) ** p, (n - 1) ** p, (n + 2) ** p, (n - 2) ** p, value + 2 * n, value - 2 * n]`, где `value = question.answer`, `p = 2` для квадратов и `3` для кубов;
  - для обратного вопроса кандидаты: `[n + 1, n - 1, n + 2, n - 2, n + 3, n - 3]`;
  - отфильтровать кандидаты: целые, `> 0`, не равны `question.answer`, без дубликатов; взять `shuffle(кандидаты).slice(0, count - 1)`;
  - если не хватает — добавлять `answer + k` для `k = 1, 2, 3, …` (пропуская нули, отрицательные и дубликаты), пока не наберётся `count - 1`;
  - вернуть `shuffle([question.answer, ...distractors])`.
- `checkAnswer(question, given)`: разобрать `given` строгим целым (`MT.toInt`); если получилось `NaN` — `false`; иначе `=== question.answer`. Строгий разбор означает: только цифры, `'49.0'` и `'ab'` — неверно, `'07'` при верном ответе `7` — верно.

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add logic.js test/logic.test.js
git commit -m "feat: варианты ответа и проверка ответа"
```

---

### Task 4: `logic.js` — итоги раунда, время и ключ лучшего результата

**Files:**
- Modify: `logic.js`
- Modify: `test/logic.test.js`

**Interfaces:**
- Consumes: ничего нового.
- Produces:
  - `MT.summarize(round) -> { total, correct, percent, seconds, secondsText, mistakes }`, где `round = { total, correct, seconds, mistakes: [{ prompt, given, answer }] }`; `percent = total > 0 ? Math.round(correct / total * 100) : 0`;
  - `MT.formatTime(seconds) -> string` — `мм:сс`, минуты не ограничены (`3600 -> '60:00'`);
  - `MT.bestKey(settings) -> string` — `` `mt.best.${kind}.${format}.${answerType}.${from}-${to}` ``;
  - `MT.isBetter(a, b) -> boolean` — `true`, если результата `b` нет или `a.correct > b.correct`, либо при равных верных `a.seconds < b.seconds`.

- [ ] **Step 1: Написать падающие тесты**

```js
test('summarize: проценты, время и разбор ошибок', () => {
  const r = MT.summarize({
    total: 10,
    correct: 7,
    seconds: 65,
    mistakes: [{ prompt: '5² = ?', given: '20', answer: 25 }]
  });
  assert.equal(r.total, 10);
  assert.equal(r.correct, 7);
  assert.equal(r.percent, 70);
  assert.equal(r.secondsText, '01:05');
  assert.deepEqual(r.mistakes, [{ prompt: '5² = ?', given: '20', answer: 25 }]);
});

test('summarize: не падает при нуле вопросов', () => {
  const r = MT.summarize({ total: 0, correct: 0, seconds: 0, mistakes: [] });
  assert.equal(r.percent, 0);
  assert.equal(r.secondsText, '00:00');
});

test('summarize: округление процента', () => {
  assert.equal(MT.summarize({ total: 3, correct: 2, seconds: 1, mistakes: [] }).percent, 67);
});

test('formatTime: границы', () => {
  assert.equal(MT.formatTime(0), '00:00');
  assert.equal(MT.formatTime(5), '00:05');
  assert.equal(MT.formatTime(59), '00:59');
  assert.equal(MT.formatTime(60), '01:00');
  assert.equal(MT.formatTime(3600), '60:00');
});

test('bestKey: ключ зависит от вида, формата, типа ответа и диапазона', () => {
  assert.equal(MT.bestKey(base), 'mt.best.square.mixed.input.1-20');
  assert.equal(
    MT.bestKey({ ...base, kind: 'cube', format: 'reverse', answerType: 'choice', from: 1, to: 10 }),
    'mt.best.cube.reverse.choice.1-10'
  );
});

test('isBetter: больше верных лучше, при равенстве — быстрее', () => {
  assert.equal(MT.isBetter({ correct: 5, seconds: 30 }, null), true);
  assert.equal(MT.isBetter({ correct: 5, seconds: 30 }, undefined), true);
  assert.equal(MT.isBetter({ correct: 6, seconds: 90 }, { correct: 5, seconds: 10 }), true);
  assert.equal(MT.isBetter({ correct: 4, seconds: 5 }, { correct: 5, seconds: 10 }), false);
  assert.equal(MT.isBetter({ correct: 5, seconds: 5 }, { correct: 5, seconds: 10 }), true);
  assert.equal(MT.isBetter({ correct: 5, seconds: 10 }, { correct: 5, seconds: 10 }), false);
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `node --test test/`
Expected: FAIL — `MT.summarize is not a function`.

- [ ] **Step 3: Реализовать функции в `logic.js`**

`secondsText` — `String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')`.

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 5: Коммит**

```bash
git add logic.js test/logic.test.js
git commit -m "feat: итоги раунда, форматирование времени и лучший результат"
```

---

### Task 5: Разметка и оформление — `index.html`, `styles.css`

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `test/markup.test.js`

**Interfaces:**
- Consumes: имена функций `MT` из Task 1–4 не требуются, но `index.html` обязан подключить `styles.css`, затем `logic.js`, затем `app.js`.
- Produces: все `id`, на которые опирается `app.js`:
  - табы: `tab-square`, `tab-cube`;
  - настройки: `profile`, `from`, `to`, `format`, `answer-type`, `round-length`, `settings-errors`, `settings-warnings`, `start-btn`;
  - экраны: `screen-settings`, `screen-quiz`, `screen-results`;
  - тренировка: `q-progress`, `q-correct`, `q-wrong`, `q-time`, `question-card`, `answer-input`, `answer-submit`, `choices`, `quit-btn`;
  - итоги: `res-summary`, `res-percent`, `res-time`, `res-mistakes`, `best-line`, `again-btn`, `settings-btn`;
  - у `body` класс темы: `theme-kid`, `theme-adult` или `theme-neutral`.

- [ ] **Step 1: Написать проверочный тест `test/markup.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

const ids = ['tab-square', 'tab-cube', 'profile', 'from', 'to', 'format', 'answer-type',
  'round-length', 'settings-errors', 'settings-warnings', 'start-btn',
  'screen-settings', 'screen-quiz', 'screen-results',
  'q-progress', 'q-correct', 'q-wrong', 'q-time', 'question-card',
  'answer-input', 'answer-submit', 'choices', 'quit-btn',
  'res-summary', 'res-percent', 'res-time', 'res-mistakes', 'best-line',
  'again-btn', 'settings-btn'];

test('index.html содержит все id, на которые опирается app.js', () => {
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `нет id="${id}"`);
});

test('index.html подключает скрипты в правильном порядке без ES-модулей', () => {
  assert.ok(html.indexOf('styles.css') < html.indexOf('logic.js'));
  assert.ok(html.indexOf('logic.js') < html.indexOf('app.js'));
  assert.ok(!html.includes('type="module"'));
});

test('styles.css содержит темы профилей и адаптив', () => {
  for (const theme of ['theme-kid', 'theme-adult', 'theme-neutral']) {
    assert.ok(css.includes(theme), `нет темы ${theme}`);
  }
  assert.ok(css.includes('@media'), 'нет @media для адаптива');
});

test('index.html не тянет внешние ресурсы', () => {
  assert.ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'найден внешний ресурс');
});
```

- [ ] **Step 2: Запустить тест и убедиться, что падает**

Run: `node --test test/markup.test.js`
Expected: FAIL — файл `index.html` не найден.

- [ ] **Step 3: Создать `index.html`**

Один документ, `lang="ru"`, `<meta name="viewport" content="width=device-width, initial-scale=1">`. Внутри:

- `<header>`: заголовок `Тренажёр: квадраты и кубы`, табы `Квадраты` / `Кубы` (`role="tablist"`).
- `#screen-settings`: селект профиля (опции `Школьник` = `kid`, `Взрослый` = `adult`, `Нейтральный` = `neutral`), поля `от` / `до` (`inputmode="numeric"`), радио-группа или селект формата (`Прямой 7² = ?` = `direct`, `Обратный 49 = ?²` = `reverse`, `Смешанный` = `mixed`), радио-группа типа ответа (`Вписать` = `input`, `Выбрать из вариантов` = `choice`), поле `Вопросов в раунде`, блоки `#settings-errors` и `#settings-warnings`, кнопка `Начать`.
- `#screen-quiz` (скрыт классом `hidden`): строка прогресса `Вопрос 1 из 10`, счётчики `Верно: 0`, `Ошибки: 0`, таймер `00:00`, карточка `#question-card`, поле `#answer-input` + кнопка `Ответить`, контейнер `#choices` (пустой, кнопки создаёт `app.js`), кнопка `Прервать`.
- `#screen-results` (скрыт): `#res-summary` (`Верно 7 из 10`), `#res-percent`, `#res-time`, список `#res-mistakes`, строка `#best-line`, кнопки `Ещё раз` и `Изменить настройки`.
- Класс `hidden` на скрытых экранах и `status`/`aria-live="polite"` на блоках сообщений и карточке вопроса.
- Подключения в конце `<body>`: `<script src="logic.js"></script>`, затем `<script src="app.js"></script>`.

- [ ] **Step 4: Создать `styles.css`**

- Базовая типографика, светлый фон, крупный шрифт вопроса (не меньше `2.5rem`), крупные кнопки (мин. высота `44px`) и заметный фокус (`:focus-visible`).
- Темы через класс на `body`: `theme-kid` (яркие акценты), `theme-adult` (сдержанные), `theme-neutral` (нейтральные). Темы задают CSS-переменные (`--accent`, `--bg`, `--card`, `--ok`, `--bad`).
- Состояния ответа: `.is-correct` (зелёная подсветка) и `.is-wrong` (красная подсветка), `.hidden { display: none }`.
- Адаптив: `@media (max-width: 600px)` — варианты ответа в один столбец, уменьшенные отступы, крупные кнопки на всю ширину.

- [ ] **Step 5: Запустить тесты и открыть страницу в браузере**

Run: `node --test test/markup.test.js`
Expected: PASS.

Run: `Start-Process index.html` (открыть в браузере)
Expected: страница открывается по `file://`, видна шапка, табы и панель настроек; скриншоты не нужны — проверьте глазами, что элементы на месте и вёрстка не разъехалась на узком окне.

- [ ] **Step 6: Коммит**

```bash
git add index.html styles.css test/markup.test.js
git commit -m "feat: разметка и оформление страницы тренажёра"
```

---

### Task 6: `app.js` — логика экранов и взаимодействие

**Files:**
- Create: `app.js`

**Interfaces:**
- Consumes: `MT.validateSettings`, `MT.defaultsFor`, `MT.applyProfile`, `MT.normalizeSettings`, `MT.buildPool`, `MT.shuffle`, `MT.nextQuestion`, `MT.questionKey`, `MT.makeChoices`, `MT.checkAnswer`, `MT.summarize`, `MT.formatTime`, `MT.bestKey`, `MT.isBetter` (Task 1–4), все `id` из Task 5.
- Produces: рабочий сайт; глобальную функцию не экспортирует.

- [ ] **Step 1: Реализовать `app.js` — состояние и настройки**

- Состояние: `activeKind` (`square`/`cube`), `settings` (объект на каждый вид), `round` (пул, `usedKeys`, `lastKey`, `index`, `correct`, `wrong`, `mistakes`, `startedAt`, `timerId`, `phase`).
- `loadSettings(kind)`: `JSON.parse` из `localStorage` в `try/catch`; результат прогнать через `MT.normalizeSettings`, записать обратно. При недоступном `localStorage` (исключение при чтении или записи) работать со значениями по умолчанию, не выбрасывать исключение наружу.
- `saveSettings(kind)`: запись в `try/catch`.
- `loadProfile()` / `saveProfile()` по ключу `mt.profile`; при загрузке применить тему классами `theme-kid` / `theme-adult` / `theme-neutral` на `body`.
- `activeSettings()` читает значения из полей формы через `MT.normalizeSettings`, чтобы нельзя было начать раунд с мусором из DOM.

- [ ] **Step 2: Реализовать настройки и валидацию в интерфейсе**

- `renderSettings(kind)`: подставить значения в поля, селект профиля, радио формата и типа ответа.
- Обработчики `input`/`change` на всех полях: `renderMessages()` — вызвать `MT.validateSettings`, вывести ошибки в `#settings-errors` и предупреждения в `#settings-warnings`, заблокировать `#start-btn` при `ok === false`.
- Смена профиля: `MT.applyProfile` к текущим настройкам, `renderSettings`, `renderMessages`, сохранить.
- Смена таба: переключить `activeKind`, обновить `aria-selected` и активный класс таба, `renderSettings` + `renderMessages`; если раунд идёт — не переключать, сначала вызвать `quitRound()`.
- Показать `#screen-settings`, скрыть остальные.

- [ ] **Step 3: Реализовать раунд — старт, вопросы, ответы**

- `startRound()`: взять `activeSettings()`, проверить `MT.validateSettings`; создать `pool = MT.shuffle(MT.buildPool(kind, from, to, format))`, обнулить счётчики и `mistakes`, зафиксировать `startedAt`, запустить `setInterval` на 1 с для обновления `#q-time` через `MT.formatTime`, показать `#screen-quiz`.
- `nextTurn()`: `MT.nextQuestion(pool, usedKeys, lastKey)`; обновить `usedKeys` (при `exhausted` — заменить на `[key]`, иначе добавить `key`), `lastKey`; отрисовать вопрос; `phase = 'answering'`.
- `renderQuestion()`: увеличить счётчик прогресса (`Вопрос i из N`), вывести `question.prompt` в `#question-card`. Для `answerType === 'input'` — показать `#answer-input` и `#answer-submit`, очистить поле, поставить фокус, скрыть `#choices`. На `input` у поля отбрасывать нецифровые символы (`value.replace(/\D/g, '')`), чтобы правило «только цифры» совпадало со строгой проверкой `MT.checkAnswer`. Для `choice` — скрыть поле ввода, очистить `#choices`, создать 4 кнопки из `MT.makeChoices(question)`, повесить обработчик на каждую.
- `submitAnswer(given)`: игнорировать, если `phase !== 'answering'` (защита от двойных кликов, Enter+клик и ввода в неактивной фазе). Для режима ввода: если строка пустая — показать сообщение `Введите ответ` и не менять фазу. Далее `phase = 'feedback'`, `MT.checkAnswer`; при верном — `correct++` и класс `is-correct` на карточке, иначе `wrong++`, `mistakes.push({ prompt, given, answer })` и класс `is-wrong` с текстом `Правильный ответ: N`. Обновить счётчики, заблокировать поле и кнопки, через `setTimeout` 900 мс вызвать `nextTurn()` или `finishRound()`.
- Enter в `#answer-input` и клик по `#answer-submit` вызывают один и тот же `submitAnswer`.
- `quitRound()`: остановить таймер, скрыть экран тренировки, показать настройки, результат не сохранять.

- [ ] **Step 4: Реализовать итоги**

- `finishRound()`: остановить таймер, `result = MT.summarize({ total: settings.roundLength, correct, seconds, mistakes })`, показать `#screen-results`, заполнить `#res-summary` (`Верно X из N`), `#res-percent`, `#res-time` (`secondsText`), `#res-mistakes` (для каждой ошибки строка `5² = ? — вы: 20, верно: 25`; список пуст, если ошибок нет), кнопки работают: `Ещё раз` → `startRound()`, `Изменить настройки` → `quitRound()`.
- Лучший результат: ключ `MT.bestKey(activeSettings())`; прочитать из `localStorage` в `try/catch`; если `MT.isBetter(result, previous)` — записать и показать в `#best-line` (`Лучший результат: X из N, время мм:сс`), иначе показать текущий сохранённый лучший.

- [ ] **Step 5: Ручная проверка (DOM-часть автотестами не покрывается)**

Run: `Start-Process index.html`

Проверить и записать результат каждого пункта:
1. Оба тренажёра × все три формата × оба типа ответа — раунд доходит до экрана итогов.
2. Граничные диапазоны `1..1`, `1..2`, `20..20`, `50..100` — раунд проходит, вопросов ровно столько, сколько задано в раунде; при `1..1` вопрос повторяется, зависаний нет.
3. Кривой ввод настроек: пусто, `0`, `-5`, `1.5`, `ab`, `999`, «От» > «До» — под каждым полем появляется сообщение об ошибке, «Начать» неактивна, в консоли пусто.
4. `from = 50` — появляется предупреждение, «Начать» активна.
5. Быстрое двойное нажатие по варианту и Enter+клик по кнопке — верный/неверный ответ засчитывается один раз, счётчики не удваиваются.
6. Пустой ответ в режиме ввода — сообщение `Введите ответ`, ошибка не засчитывается.
7. Перезагрузка страницы (F5) — настройки и лучший результат восстановились.
8. Проверка `localStorage` с мусором: в консоли выполнить `localStorage.setItem('mt.settings.square', '{{{{')` и перезагрузить — страница работает на умолчаниях, ошибок нет.
9. Отключённый `localStorage`: открыть вкладку в приватном окне — сайт работает, ошибок в консоли нет.
10. Ширина окна 360 px и 1440 px — вёрстка не ломается, варианты ответа в один столбец на узком экране.
11. Консоль браузера — без ошибок и предупреждений.

- [ ] **Step 6: Коммит**

```bash
git add app.js
git commit -m "feat: логика экранов тренажёра, оба типа ответа и итоги"
```

---

### Task 7: README и публикация на GitHub Pages

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: готовый сайт из Task 5–6.
- Produces: публичный репозиторий `MrFeoder/math-trainer` с включённым GitHub Pages по адресу `https://mrfeoder.github.io/math-trainer/`.

- [ ] **Step 1: Создать `README.md`**

Разделы: что это (`Тренажёр «Квадраты и кубы»`), адрес сайта `https://mrfeoder.github.io/math-trainer/`, как открыть локально (двойной клик по `index.html`), как прогнать тесты (`node --test test/`), как устроен проект (файлы и их роли), как проверить, что существующий сайт `besplatniy-sait` не затронут (репозиторий отдельный).

- [ ] **Step 2: Коммит README**

```bash
git add README.md
git commit -m "docs: README с описанием тренажёра и запуском тестов"
```

- [ ] **Step 3: Создать репозиторий и запушить**

```bash
gh repo create MrFeoder/math-trainer --public --source . --push --description "Тренажёр: квадраты и кубы чисел"
```

Expected: репозиторий создан, ветка `main` запушена.

- [ ] **Step 4: Включить GitHub Pages**

```bash
gh api -X POST repos/MrFeoder/math-trainer/pages -f "source[branch]=main" -f "source[path]=/"
```

Expected: ответ содержит `"html_url": "https://mrfeoder.github.io/math-trainer/"`. Если API вернул `409` — Pages уже включён, это не ошибка.

- [ ] **Step 5: Дождаться сборки и проверить сайт**

```bash
gh api repos/MrFeoder/math-trainer/pages --jq '.status'
```

Повторять, пока `status` не станет `built` (обычно до 2 минут). Затем:

```bash
curl -sS https://mrfeoder.github.io/math-trainer/ | Select-String -Pattern "Квадраты","Кубы"
```

Expected: в ответе есть `Квадраты` и `Кубы`; страница открывается по https без 404.

- [ ] **Step 6: Проверить, что существующий сайт не затронут**

```bash
gh repo view MrFeoder/besplatniy-sait --json name,updatedAt,pushedAt
git -C C:\Users\Фёдор\site status --short
```

Expected: время `pushedAt` не менялось в ходе этой работы; рабочая копия `C:\Users\Фёдор\site` без изменений.

- [ ] **Step 7: Финальный прогон всех тестов**

```bash
node --test test/
```

Expected: PASS — все тесты логики и разметки зелёные.

---

## Открытые вопросы

Нет. Все решения зафиксированы в spec; имя репозитория — `MrFeoder/math-trainer` (подтверждено пользователем, можно переименовать перед Task 7 Step 3).
