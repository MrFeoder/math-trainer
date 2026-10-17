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

test('index.html не тянет внешние ресурсы (гиперссылки не считаются)', () => {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const withoutHyperlinks = withoutComments.replace(/<a\b[^>]*>/gi, '');
  assert.ok(!/https?:\/\//.test(withoutHyperlinks), 'найден внешний ресурс');
});

test('index.html содержит кнопку-донат со ссылкой на dalink.to', () => {
  const tag = html.match(/<a\b[^>]*class="donate-btn"[^>]*>/i);
  assert.ok(tag, 'нет ссылки с классом donate-btn');
  assert.ok(tag[0].includes('href="https://dalink.to/mr_feoder"'), `ссылка ведёт не туда: ${tag[0]}`);
  assert.ok(tag[0].includes('target="_blank"'), 'ссылка должна открываться в новой вкладке');
  assert.ok(tag[0].includes('rel="noopener"'), 'нужен rel="noopener"');
});

test('styles.css оформляет кнопку-донат цветом темы', () => {
  assert.ok(css.includes('.donate-btn'), 'нет класса .donate-btn');
  const block = css.slice(css.indexOf('.donate-btn'));
  assert.ok(block.includes('position: fixed'), 'кнопка должна быть закреплена');
  assert.ok(block.includes('var(--accent)'), 'цвет кнопки должен браться из темы');
});
