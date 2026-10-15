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
