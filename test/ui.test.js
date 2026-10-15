// UI-тесты app.js на минимальном DOM-стабе без внешних зависимостей.
// Стаб поддерживает ровно те возможности, которые использует app.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MT = require('../logic.js');

function idsFromMarkup() {
  const ids = [];
  const re = /id="([^"]+)"/g;
  let match = re.exec(html);
  while (match) {
    ids.push(match[1]);
    match = re.exec(html);
  }
  return ids;
}

function createElement(tagName) {
  const classes = [];
  const attributes = {};
  const listeners = {};
  const element = {
    tagName: String(tagName || 'div').toUpperCase(),
    id: '',
    children: [],
    parentNode: null,
    textContent: '',
    value: '',
    disabled: false,
    type: '',
    classList: {
      add: function (name) { if (classes.indexOf(name) === -1) classes.push(name); },
      remove: function (name) { const i = classes.indexOf(name); if (i !== -1) classes.splice(i, 1); },
      contains: function (name) { return classes.indexOf(name) !== -1; },
      toggle: function (name, force) {
        const has = classes.indexOf(name) !== -1;
        const want = force === undefined ? !has : !!force;
        if (want) element.classList.add(name); else element.classList.remove(name);
        return want;
      },
      toString: function () { return classes.join(' '); }
    },
    get className() { return classes.join(' '); },
    setAttribute: function (name, value) { attributes[name] = String(value); },
    getAttribute: function (name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
    appendChild: function (child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    removeChild: function (child) {
      const i = element.children.indexOf(child);
      if (i !== -1) element.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    get firstChild() { return element.children.length ? element.children[0] : null; },
    set innerHTML(value) { element.children.length = 0; element._innerHTML = value; },
    get innerHTML() { return element._innerHTML || ''; },
    focus: function () {},
    addEventListener: function (type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    click: function () {
      (listeners.click || []).forEach(function (handler) { handler({ type: 'click' }); });
    },
    dispatch: function (type, event) {
      (listeners[type] || []).forEach(function (handler) { handler(event || { type: type }); });
    }
  };
  return element;
}

function createApp(options) {
  const opts = options || {};
  const registry = {};
  idsFromMarkup().forEach(function (id) { registry[id] = createElement('div'); });
  registry['answer-input'].tagName = 'INPUT';
  registry['from'].tagName = 'INPUT';
  registry['to'].tagName = 'INPUT';
  registry['round-length'].tagName = 'INPUT';
  registry.profile.tagName = 'SELECT';
  registry['answer-type'].tagName = 'SELECT';
  registry.format.tagName = 'SELECT';

  const body = createElement('body');
  body.classList.add('theme-kid');

  const timeouts = [];
  const intervals = [];
  let timeoutsRan = 0;

  const store = {};
  const localStorage = {
    getItem: function (key) {
      if (opts.localStorageThrows) throw new Error('localStorage недоступен');
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem: function (key, value) {
      if (opts.localStorageThrows) throw new Error('localStorage недоступен');
      store[key] = String(value);
    }
  };
  if (opts.seed) {
    Object.keys(opts.seed).forEach(function (key) { store[key] = opts.seed[key]; });
  }

  const documentStub = {
    body: body,
    getElementById: function (id) { return registry[id] || null; },
    createElement: createElement
  };

  const windowStub = {
    MT: MT,
    localStorage: localStorage,
    document: documentStub
  };

  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage: localStorage,
    MT: MT,
    console: console,
    Date: Date,
    Math: Math,
    JSON: JSON,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Array: Array,
    Object: Object,
    parseInt: parseInt,
    isNaN: isNaN,
    setInterval: function (fn, delay) { intervals.push({ fn: fn, delay: delay, cleared: false }); return intervals.length; },
    clearInterval: function (id) { var t = intervals[id - 1]; if (t) t.cleared = true; },
    setTimeout: function (fn, delay) { timeouts.push({ fn: fn, delay: delay, cleared: false }); return timeouts.length; },
    clearTimeout: function (id) { var t = timeouts[id - 1]; if (t) t.cleared = true; }
  };

  vm.createContext(sandbox);
  vm.runInContext(appSource, sandbox, { filename: 'app.js' });

  return {
    dom: registry,
    body: body,
    store: store,
    timers: timeouts,
    app: windowStub.MTApp,
    fire: function (id, type, event) { registry[id].dispatch(type, event); },
    click: function (id) { registry[id].click(); },
    runTimers: function () {
      while (timeoutsRan < timeouts.length) {
        const timer = timeouts[timeoutsRan];
        timeoutsRan += 1;
        if (!timer.cleared) timer.fn();
      }
    }
  };
}

function answerText(question) {
  return String(question.answer);
}

function startRoundWith(app, patch) {
  Object.keys(patch).forEach(function (key) {
    const el = app.dom[key];
    el.value = patch[key];
  });
  app.fire('from', 'change');
  app.app.startRound();
}

test('стартовое состояние: настройки видны, квиз и итоги скрыты, кнопка активна', () => {
  const app = createApp();
  assert.equal(app.dom['screen-settings'].classList.contains('hidden'), false);
  assert.equal(app.dom['screen-quiz'].classList.contains('hidden'), true);
  assert.equal(app.dom['screen-results'].classList.contains('hidden'), true);
  assert.equal(app.dom['start-btn'].disabled, false);
  assert.equal(app.dom.from.value, 1);
  assert.equal(app.dom.to.value, 20);
  assert.equal(app.store['mt.settings.square'] !== undefined, true);
  assert.equal(app.store['mt.profile'], 'kid', 'профиль записывается сразу при первом запуске');
});

test('ошибки настроек выводятся, «Начать» блокируется, предупреждение не блокирует', () => {
  const app = createApp();
  app.dom.from.value = '';
  app.app.onFieldChange();
  assert.ok(app.dom['settings-errors'].textContent.includes('От'), app.dom['settings-errors'].textContent);
  assert.equal(app.dom['start-btn'].disabled, true);

  app.dom.from.value = 20;
  app.dom.to.value = 5;
  app.app.onFieldChange();
  assert.ok(app.dom['settings-errors'].textContent.includes('больше'));
  assert.equal(app.dom['start-btn'].disabled, true);

  app.dom.from.value = 50;
  app.dom.to.value = 60;
  app.app.onFieldChange();
  assert.ok(app.dom['settings-warnings'].textContent.length > 0);
  assert.equal(app.dom['start-btn'].disabled, false);
});

test('режим «вписать»: верный и неверный ответы считаются один раз', () => {
  const app = createApp();
  app.app.startRound();
  assert.equal(app.dom['screen-quiz'].classList.contains('hidden'), false);
  assert.equal(app.app.getState().round.phase, 'answering');

  const q = app.app.getState().round.question;
  app.app.submitAnswer(answerText(q));
  assert.equal(app.app.getState().round.correct, 1);
  assert.equal(app.dom['question-card'].classList.contains('is-correct'), true);
  assert.equal(app.dom['q-correct'].textContent, 'Верно: 1');

  app.app.submitAnswer(answerText(q));
  assert.equal(app.app.getState().round.correct, 1, 'повторный ответ в фазе feedback не засчитывается');

  app.runTimers();
  const q2 = app.app.getState().round.question;
  app.app.submitAnswer(String(q2.answer + 1));
  assert.equal(app.app.getState().round.wrong, 1);
  assert.equal(app.dom['question-card'].classList.contains('is-wrong'), true);
  assert.equal(app.app.getState().round.mistakes.length, 1);
  assert.equal(app.app.getState().round.mistakes[0].answer, q2.answer);
});

test('пустой ответ: подсказка и отсутствие засчитанной ошибки', () => {
  const app = createApp();
  app.app.startRound();
  const before = app.app.getState().round;
  app.app.submitAnswer('');
  assert.equal(app.dom['answer-hint'].textContent, 'Введите ответ');
  assert.equal(app.app.getState().round.phase, 'answering');
  assert.equal(before.correct + before.wrong, 0);

  const q = app.app.getState().round.question;
  app.app.submitAnswer('07' === '0' ? '' : answerText(q));
  assert.equal(app.app.getState().round.correct, 1);
});

test('раунд доходит до итогов и сохраняет лучший результат', () => {
  const app = createApp();
  app.dom['round-length'].value = 3;
  app.dom.from.value = 1;
  app.dom.to.value = 3;
  app.fire('from', 'change');
  app.app.startRound();

  for (let i = 0; i < 3; i++) {
    const q = app.app.getState().round.question;
    app.app.submitAnswer(answerText(q));
    app.runTimers();
  }

  assert.equal(app.dom['screen-results'].classList.contains('hidden'), false);
  assert.equal(app.dom['res-summary'].textContent, 'Верно 3 из 3');
  assert.equal(app.dom['res-percent'].textContent, '100%');
  assert.ok(app.dom['best-line'].textContent.includes('Лучший результат'), app.dom['best-line'].textContent);
  assert.ok(app.store['mt.best.square.mixed.input.1-3'], 'лучший результат сохранён');
});

test('режим «выбрать из вариантов»: 4 кнопки, верная кнопка отмечается', () => {
  const app = createApp();
  app.dom['answer-type'].value = 'choice';
  app.fire('answer-type', 'change');
  app.app.startRound();

  assert.equal(app.dom.choices.children.length, 4);
  assert.equal(app.dom['input-area'].classList.contains('hidden'), true);

  const q = app.app.getState().round.question;
  const buttons = app.dom.choices.children;
  const correctButton = buttons.filter(function (b) { return b.textContent === String(q.answer); })[0];
  assert.ok(correctButton, 'верный вариант присутствует');

  correctButton.click();
  assert.equal(app.app.getState().round.correct, 1);
  assert.equal(correctButton.classList.contains('is-correct'), true);
  assert.equal(app.dom['question-card'].classList.contains('is-correct'), true);
});

test('неверный вариант в режиме выбора подсвечивает и правильную кнопку', () => {
  const app = createApp();
  app.dom['answer-type'].value = 'choice';
  app.fire('answer-type', 'change');
  app.app.startRound();

  const q = app.app.getState().round.question;
  const buttons = app.dom.choices.children;
  const wrongButton = buttons.filter(function (b) { return b.textContent !== String(q.answer); })[0];
  wrongButton.click();

  assert.equal(app.app.getState().round.wrong, 1);
  assert.equal(wrongButton.classList.contains('is-wrong'), true);
  const correctButton = buttons.filter(function (b) { return b.textContent === String(q.answer); })[0];
  assert.equal(correctButton.classList.contains('is-correct'), true);
  const expected = q.prompt + ' — правильный ответ: ' + q.answer;
  assert.equal(app.dom['question-card'].textContent, expected);
});

test('мусор в localStorage: приложение работает на умолчаниях', () => {
  const app = createApp({ seed: { 'mt.settings.square': '{{{{', 'mt.settings.cube': 'не json' } });
  assert.equal(app.dom.from.value, 1);
  assert.equal(app.dom.to.value, 20);
  assert.equal(app.dom['start-btn'].disabled, false);
  assert.equal(app.app.getState().settings.square.format, 'mixed');
});

test('недоступный localStorage: приложение работает без исключений', () => {
  const app = createApp({ localStorageThrows: true });
  assert.equal(app.dom.from.value, 1);
  app.app.startRound();
  assert.equal(app.app.getState().round.phase, 'answering');
  const q = app.app.getState().round.question;
  app.app.submitAnswer(answerText(q));
  assert.equal(app.app.getState().round.correct, 1);
});

test('диапазон 1..1: вопросы повторяются, раунд завершается', () => {
  const app = createApp();
  app.dom.from.value = 1;
  app.dom.to.value = 1;
  app.dom['round-length'].value = 2;
  app.fire('from', 'change');
  app.app.startRound();

  for (let i = 0; i < 2; i++) {
    const q = app.app.getState().round.question;
    assert.equal(q.n, 1);
    app.app.submitAnswer(answerText(q));
    app.runTimers();
  }

  assert.equal(app.dom['screen-results'].classList.contains('hidden'), false);
  assert.equal(app.dom['res-summary'].textContent, 'Верно 2 из 2');
});

test('переключение тренажёра подставляет настройки своего вида', () => {
  const app = createApp();
  app.dom.from.value = 4;
  app.dom.to.value = 9;
  app.fire('from', 'change');

  app.app.switchKind('cube');
  assert.equal(app.app.getState().activeKind, 'cube');
  assert.equal(app.dom.to.value, 10, 'диапазон кубов по умолчанию');
  assert.equal(app.store['mt.settings.square'] !== undefined, true);

  app.app.switchKind('square');
  assert.equal(app.dom.from.value, 4);
  assert.equal(app.dom.to.value, 9);
});

test('смена профиля меняет тему и диапазон', () => {
  const app = createApp();
  app.dom.profile.value = 'adult';
  app.app.onProfileChange();
  assert.equal(app.app.getState().settings.square.profile, 'adult');
  assert.equal(app.body.classList.contains('theme-adult'), true);
  assert.equal(app.body.classList.contains('theme-kid'), false);
  assert.equal(app.dom.to.value, 30);
  assert.equal(app.store['mt.profile'], 'adult');
});

test('Enter в поле ответа подтверждает ответ', () => {
  const app = createApp();
  app.app.startRound();
  const q = app.app.getState().round.question;
  app.dom['answer-input'].value = answerText(q);
  let prevented = false;
  app.fire('answer-input', 'keydown', {
    key: 'Enter',
    preventDefault: function () { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(app.app.getState().round.correct, 1);
});

test('в поле ответа отбрасываются нецифровые символы', () => {
  const app = createApp();
  app.app.startRound();
  app.dom['answer-input'].value = '1a2b3';
  app.fire('answer-input', 'input', { type: 'input' });
  assert.equal(app.dom['answer-input'].value, '123');
});

test('быстрый «Прервать» + «Начать» не пропускает первый вопрос нового раунда', () => {
  const app = createApp();
  app.dom['round-length'].value = 3;
  app.dom.from.value = 1;
  app.dom.to.value = 3;
  app.fire('from', 'change');
  app.app.startRound();

  const q1 = app.app.getState().round.question;
  app.app.submitAnswer(String(q1.answer));
  app.click('quit-btn');
  app.app.startRound();

  app.runTimers();

  assert.equal(
    app.app.getState().round.index,
    1,
    'зависший таймер прошлого раунда не должен перескакивать первый вопрос'
  );
  assert.equal(app.app.getState().round.phase, 'answering');
});

test('смена тренажёра приводит тему в соответствие с профилем видимого селектора', () => {
  const app = createApp();
  app.dom.profile.value = 'adult';
  app.app.onProfileChange();
  assert.equal(app.body.classList.contains('theme-adult'), true);

  app.app.switchKind('cube');

  assert.equal(app.dom.profile.value, app.app.getState().settings.cube.profile);
  assert.equal(
    app.body.classList.contains('theme-' + app.app.getState().settings.cube.profile),
    true,
    'тема обязана совпадать с профилем, показанным в селекторе'
  );
});

test('кнопка «Прервать» возвращает в настройки и не пишет лучший результат', () => {
  const app = createApp();
  app.app.startRound();
  app.click('quit-btn');
  assert.equal(app.dom['screen-settings'].classList.contains('hidden'), false);
  assert.equal(app.app.getState().round, null);
  assert.equal(Object.keys(app.store).some(function (k) { return k.indexOf('mt.best.') === 0; }), false);
});
