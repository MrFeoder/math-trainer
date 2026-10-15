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
    normalizeSettings: normalizeSettings
  };
});
