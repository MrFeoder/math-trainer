(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KINDS = ['square', 'cube'];
  const FORMATS = ['direct', 'reverse', 'mixed'];
  const ANSWER_TYPES = ['input', 'choice'];
  const PROFILES = {
    kid: { square: { from: 1, to: 20 }, cube: { from: 1, to: 10 } },
    adult: { square: { from: 1, to: 30 }, cube: { from: 1, to: 15 } },
    neutral: { square: { from: 1, to: 20 }, cube: { from: 1, to: 12 } }
  };

  function toInt(value) {
    if (value === null || value === undefined) return NaN;
    const s = String(value).trim();
    if (!/^\d+$/.test(s)) return NaN;
    return parseInt(s, 10);
  }

  function isIntIn(value, min, max) {
    const n = toInt(value);
    return Number.isInteger(n) && n >= min && n <= max;
  }

  function defaultsFor(kind) {
    const k = KINDS.indexOf(kind) !== -1 ? kind : 'square';
    const range = PROFILES.kid[k];
    return {
      kind: k,
      profile: 'kid',
      from: range.from,
      to: range.to,
      format: 'mixed',
      answerType: 'input',
      roundLength: 10
    };
  }

  function applyProfile(settings, profile) {
    const p = PROFILES[profile] ? profile : 'kid';
    const src = settings && typeof settings === 'object' ? settings : {};
    const kind = KINDS.indexOf(src.kind) !== -1 ? src.kind : 'square';
    const range = PROFILES[p][kind];
    return Object.assign({}, defaultsFor(kind), src, {
      kind: kind,
      profile: p,
      from: range.from,
      to: range.to
    });
  }

  function validateSettings(settings) {
    const s = settings && typeof settings === 'object' ? settings : {};
    const errors = [];
    const warnings = [];

    if (KINDS.indexOf(s.kind) === -1) errors.push('Неизвестный тренажёр');

    const from = toInt(s.from);
    if (!isIntIn(s.from, 1, 100)) errors.push('«От»: нужно целое число от 1 до 100');

    const to = toInt(s.to);
    if (!isIntIn(s.to, 1, 100)) errors.push('«До»: нужно целое число от 1 до 100');

    if (isIntIn(s.from, 1, 100) && isIntIn(s.to, 1, 100) && from > to) {
      errors.push('«От» не может быть больше «До»');
    }

    if (!isIntIn(s.roundLength, 1, 100)) {
      errors.push('«Вопросов в раунде»: нужно целое число от 1 до 100');
    }

    if (FORMATS.indexOf(s.format) === -1) errors.push('Неизвестный формат задания');
    if (ANSWER_TYPES.indexOf(s.answerType) === -1) errors.push('Неизвестный тип ответа');

    if (errors.length === 0 && from >= 50) {
      warnings.push('Числа от 50: ответы будут очень большими');
    }

    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  function questionKey(question) {
    return question.format + ':' + question.n;
  }

  function shuffle(array) {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function buildPool(kind, from, to, format) {
    const k = KINDS.indexOf(kind) !== -1 ? kind : 'square';
    const f = FORMATS.indexOf(format) !== -1 ? format : 'mixed';
    const lo = toInt(from);
    const hi = toInt(to);
    if (!Number.isInteger(lo) || !Number.isInteger(hi)) return [];
    if (lo > hi) return [];
    const start = lo;
    const end = hi;
    const isSquare = k === 'square';
    const mark = isSquare ? '²' : '³';
    const formats = f === 'mixed' ? ['direct', 'reverse'] : [f];
    const pool = [];
    for (let i = 0; i < formats.length; i++) {
      const fmt = formats[i];
      for (let n = start; n <= end; n++) {
        const value = isSquare ? n * n : n * n * n;
        pool.push({
          kind: k,
          n: n,
          format: fmt,
          prompt: fmt === 'direct' ? n + mark + ' = ?' : value + ' = ?' + mark,
          answer: fmt === 'direct' ? value : n
        });
      }
    }
    return pool;
  }

  function nextQuestion(pool, usedKeys, lastKey) {
    const used = Array.isArray(usedKeys) ? usedKeys : [];
    const available = pool.filter(function (q) {
      const key = questionKey(q);
      return used.indexOf(key) === -1 && key !== lastKey;
    });
    if (available.length > 0) {
      return {
        question: available[Math.floor(Math.random() * available.length)],
        exhausted: false
      };
    }
    let fallback = pool.filter(function (q) {
      return questionKey(q) !== lastKey || pool.length === 1;
    });
    if (fallback.length === 0) fallback = pool;
    return {
      question: fallback[Math.floor(Math.random() * fallback.length)],
      exhausted: true
    };
  }

  function makeChoices(question, count) {
    const total = Number.isInteger(count) && count > 1 ? count : 4;
    const n = question.n;
    const value = question.answer;
    const p = question.kind === 'square' ? 2 : 3;
    const candidates = question.format === 'direct'
      ? [
          value + n, value - n,
          Math.pow(n + 1, p), Math.pow(n - 1, p),
          Math.pow(n + 2, p), Math.pow(n - 2, p),
          value + 2 * n, value - 2 * n
        ]
      : [n + 1, n - 1, n + 2, n - 2, n + 3, n - 3];

    const unique = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (Number.isInteger(c) && c > 0 && c !== value && unique.indexOf(c) === -1) unique.push(c);
    }

    const distractors = shuffle(unique).slice(0, total - 1);
    let k = 1;
    while (distractors.length < total - 1 && k <= 1000) {
      const c = value + k;
      if (c > 0 && c !== value && distractors.indexOf(c) === -1) distractors.push(c);
      k++;
    }

    return shuffle([value].concat(distractors));
  }

  function checkAnswer(question, given) {
    const parsed = toInt(given);
    if (!Number.isInteger(parsed)) return false;
    return parsed === question.answer;
  }

  function formatTime(seconds) {
    const s = Math.floor(seconds);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function summarize(round) {
    const r = round && typeof round === 'object' ? round : {};
    const total = Number.isFinite(r.total) ? r.total : 0;
    const correct = Number.isFinite(r.correct) ? r.correct : 0;
    const seconds = Number.isFinite(r.seconds) ? r.seconds : 0;
    return {
      total: total,
      correct: correct,
      percent: total > 0 ? Math.round(correct / total * 100) : 0,
      seconds: seconds,
      secondsText: formatTime(seconds),
      mistakes: Array.isArray(r.mistakes) ? r.mistakes : []
    };
  }

  function bestKey(settings) {
    const s = settings && typeof settings === 'object' ? settings : {};
    return 'mt.best.' + s.kind + '.' + s.format + '.' + s.answerType + '.' + s.from + '-' + s.to;
  }

  function isBetter(a, b) {
    if (!b) return true;
    if (a.correct !== b.correct) return a.correct > b.correct;
    return a.seconds < b.seconds;
  }

  function normalizeSettings(raw, kind) {
    const k = KINDS.indexOf(kind) !== -1 ? kind : 'square';
    const def = defaultsFor(k);
    const r = raw && typeof raw === 'object' ? raw : {};

    const s = {
      kind: k,
      profile: PROFILES[r.profile] ? r.profile : def.profile,
      from: isIntIn(r.from, 1, 100) ? toInt(r.from) : def.from,
      to: isIntIn(r.to, 1, 100) ? toInt(r.to) : def.to,
      format: FORMATS.indexOf(r.format) !== -1 ? r.format : def.format,
      answerType: ANSWER_TYPES.indexOf(r.answerType) !== -1 ? r.answerType : def.answerType,
      roundLength: isIntIn(r.roundLength, 1, 100) ? toInt(r.roundLength) : def.roundLength
    };

    if (s.from > s.to) {
      s.from = def.from;
      s.to = def.to;
    }

    return s;
  }

  return {
    KINDS: KINDS,
    FORMATS: FORMATS,
    ANSWER_TYPES: ANSWER_TYPES,
    PROFILES: PROFILES,
    toInt: toInt,
    defaultsFor: defaultsFor,
    applyProfile: applyProfile,
    validateSettings: validateSettings,
    normalizeSettings: normalizeSettings,
    questionKey: questionKey,
    shuffle: shuffle,
    buildPool: buildPool,
    nextQuestion: nextQuestion,
    makeChoices: makeChoices,
    checkAnswer: checkAnswer,
    summarize: summarize,
    formatTime: formatTime,
    bestKey: bestKey,
    isBetter: isBetter
  };
});
