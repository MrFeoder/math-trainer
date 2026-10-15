(function () {
  'use strict';

  var MT = window.MT;

  function byId(id) {
    return document.getElementById(id);
  }

  var els = {
    tabs: { square: byId('tab-square'), cube: byId('tab-cube') },
    screens: {
      settings: byId('screen-settings'),
      quiz: byId('screen-quiz'),
      results: byId('screen-results')
    },
    profile: byId('profile'),
    from: byId('from'),
    to: byId('to'),
    format: byId('format'),
    answerType: byId('answer-type'),
    roundLength: byId('round-length'),
    settingsErrors: byId('settings-errors'),
    settingsWarnings: byId('settings-warnings'),
    startBtn: byId('start-btn'),
    qProgress: byId('q-progress'),
    qCorrect: byId('q-correct'),
    qWrong: byId('q-wrong'),
    qTime: byId('q-time'),
    questionCard: byId('question-card'),
    inputArea: byId('input-area'),
    answerInput: byId('answer-input'),
    answerSubmit: byId('answer-submit'),
    answerHint: byId('answer-hint'),
    choices: byId('choices'),
    quitBtn: byId('quit-btn'),
    resSummary: byId('res-summary'),
    resPercent: byId('res-percent'),
    resTime: byId('res-time'),
    resMistakes: byId('res-mistakes'),
    bestLine: byId('best-line'),
    againBtn: byId('again-btn'),
    settingsBtn: byId('settings-btn'),
    body: document.body
  };

  var SETTINGS_KEYS = { square: 'mt.settings.square', cube: 'mt.settings.cube' };
  var PROFILE_KEY = 'mt.profile';
  var THEMES = ['theme-kid', 'theme-adult', 'theme-neutral'];
  var FEEDBACK_DELAY = 900;

  var activeKind = 'square';
  var settings = { square: null, cube: null };
  var round = null;

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* приватный режим или переполнение — работаем без сохранения */
    }
  }

  function loadSettings(kind) {
    var raw = null;
    var stored = storageGet(SETTINGS_KEYS[kind]);
    if (stored) {
      try {
        raw = JSON.parse(stored);
      } catch (error) {
        raw = null;
      }
    }
    if (!raw || typeof raw !== 'object') raw = {};
    if (!raw.profile) raw.profile = storageGet(PROFILE_KEY) || 'kid';
    var normalized = MT.normalizeSettings(raw, kind);
    settings[kind] = normalized;
    storageSet(SETTINGS_KEYS[kind], JSON.stringify(normalized));
    return normalized;
  }

  function saveSettings(kind) {
    storageSet(SETTINGS_KEYS[kind], JSON.stringify(settings[kind]));
  }

  function readRaw() {
    return {
      kind: activeKind,
      profile: els.profile.value,
      from: String(els.from.value).trim(),
      to: String(els.to.value).trim(),
      format: els.format.value,
      answerType: els.answerType.value,
      roundLength: String(els.roundLength.value).trim()
    };
  }

  function readForm() {
    return MT.normalizeSettings(readRaw(), activeKind);
  }

  function renderMessages() {
    var verdict = MT.validateSettings(readRaw());
    els.settingsErrors.textContent = verdict.errors.join('; ');
    els.settingsWarnings.textContent = verdict.warnings.join('; ');
    els.startBtn.disabled = !verdict.ok;
    return verdict.ok;
  }

  function renderSettings(kind) {
    var s = settings[kind];
    els.profile.value = s.profile;
    els.from.value = s.from;
    els.to.value = s.to;
    els.format.value = s.format;
    els.answerType.value = s.answerType;
    els.roundLength.value = s.roundLength;
  }

  function applyTheme(profile) {
    var theme = 'theme-' + (MT.PROFILES[profile] ? profile : 'kid');
    var i;
    for (i = 0; i < THEMES.length; i++) els.body.classList.remove(THEMES[i]);
    els.body.classList.add(theme);
  }

  function showScreen(name) {
    els.screens.settings.classList.toggle('hidden', name !== 'settings');
    els.screens.quiz.classList.toggle('hidden', name !== 'quiz');
    els.screens.results.classList.toggle('hidden', name !== 'results');
  }

  function updateTabs() {
    var kinds = ['square', 'cube'];
    var i;
    for (i = 0; i < kinds.length; i++) {
      var tab = els.tabs[kinds[i]];
      var active = kinds[i] === activeKind;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  function elapsedSeconds() {
    return Math.max(0, Math.floor((Date.now() - round.startedAt) / 1000));
  }

  function startTimer() {
    els.qTime.textContent = '00:00';
    return setInterval(function () {
      els.qTime.textContent = MT.formatTime(elapsedSeconds());
    }, 1000);
  }

  function stopTimer() {
    if (round && round.timerId) {
      clearInterval(round.timerId);
      round.timerId = 0;
    }
  }

  function clearChildren(element) {
    element.innerHTML = '';
  }

  function startRound() {
    if (!renderMessages()) return;
    var s = readForm();
    settings[activeKind] = s;
    saveSettings(activeKind);

    round = {
      settings: s,
      pool: MT.shuffle(MT.buildPool(activeKind, s.from, s.to, s.format)),
      usedKeys: [],
      lastKey: null,
      index: 0,
      correct: 0,
      wrong: 0,
      mistakes: [],
      startedAt: Date.now(),
      timerId: 0,
      phase: 'idle',
      running: true,
      question: null
    };

    els.qCorrect.textContent = 'Верно: 0';
    els.qWrong.textContent = 'Ошибки: 0';
    els.answerHint.textContent = '';
    round.timerId = startTimer();
    showScreen('quiz');
    nextTurn();
  }

  function nextTurn() {
    if (!round || !round.running) return;
    if (round.index >= round.settings.roundLength) {
      finishRound();
      return;
    }

    round.index += 1;
    var next = MT.nextQuestion(round.pool, round.usedKeys, round.lastKey);
    var key = MT.questionKey(next.question);
    if (next.exhausted) {
      round.usedKeys = [key];
    } else {
      round.usedKeys.push(key);
    }
    round.lastKey = key;
    round.question = next.question;

    renderQuestion();
    round.phase = 'answering';
  }

  function renderQuestion() {
    var q = round.question;
    els.qProgress.textContent = 'Вопрос ' + round.index + ' из ' + round.settings.roundLength;
    els.questionCard.classList.remove('is-correct');
    els.questionCard.classList.remove('is-wrong');
    els.questionCard.textContent = q.prompt;
    els.answerHint.textContent = '';

    var useInput = round.settings.answerType === 'input';
    els.inputArea.classList.toggle('hidden', !useInput);
    els.choices.classList.toggle('hidden', useInput);

    if (useInput) {
      els.answerInput.value = '';
      els.answerInput.disabled = false;
      els.answerSubmit.disabled = false;
      if (typeof els.answerInput.focus === 'function') els.answerInput.focus();
      return;
    }

    clearChildren(els.choices);
    var options = MT.makeChoices(q);
    var i;
    for (i = 0; i < options.length; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(options[i]);
      button.addEventListener('click', function (option, element) {
        return function () {
          submitAnswer(String(option), element);
        };
      }(options[i], button));
      els.choices.appendChild(button);
    }
  }

  function setAnswerDisabled(disabled) {
    els.answerInput.disabled = disabled;
    els.answerSubmit.disabled = disabled;
    var buttons = els.choices.children;
    var i;
    for (i = 0; i < buttons.length; i++) buttons[i].disabled = disabled;
  }

  function markChoiceButtons(answer) {
    var buttons = els.choices.children;
    var i;
    for (i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent === String(answer)) buttons[i].classList.add('is-correct');
    }
  }

  function submitAnswer(given, element) {
    if (!round || !round.running || round.phase !== 'answering') return;

    var q = round.question;
    var isInput = round.settings.answerType === 'input';
    var text = given === undefined || given === null ? '' : String(given).trim();

    if (isInput && text === '') {
      els.answerHint.textContent = 'Введите ответ';
      return;
    }

    round.phase = 'feedback';
    var ok = MT.checkAnswer(q, text);

    if (ok) {
      round.correct += 1;
      els.questionCard.classList.add('is-correct');
    } else {
      round.wrong += 1;
      round.mistakes.push({ prompt: q.prompt, given: text, answer: q.answer });
      els.questionCard.classList.add('is-wrong');
      els.questionCard.textContent = q.prompt + ' — правильный ответ: ' + q.answer;
      if (!isInput) markChoiceButtons(q.answer);
    }

    if (!isInput && element && element.classList) {
      element.classList.add(ok ? 'is-correct' : 'is-wrong');
    }

    els.qCorrect.textContent = 'Верно: ' + round.correct;
    els.qWrong.textContent = 'Ошибки: ' + round.wrong;
    els.answerHint.textContent = ok ? '' : 'Правильный ответ: ' + q.answer;
    setAnswerDisabled(true);

    setTimeout(function () {
      nextTurn();
    }, FEEDBACK_DELAY);
  }

  function finishRound() {
    stopTimer();
    round.running = false;
    round.phase = 'done';

    var result = MT.summarize({
      total: round.settings.roundLength,
      correct: round.correct,
      seconds: elapsedSeconds(),
      mistakes: round.mistakes
    });

    var key = MT.bestKey(round.settings);
    var previous = null;
    var stored = storageGet(key);
    if (stored) {
      try {
        previous = JSON.parse(stored);
      } catch (error) {
        previous = null;
      }
    }

    var best = previous;
    if (MT.isBetter(result, previous)) {
      best = { correct: result.correct, total: result.total, seconds: result.seconds };
      storageSet(key, JSON.stringify(best));
    }

    els.resSummary.textContent = 'Верно ' + result.correct + ' из ' + result.total;
    els.resPercent.textContent = result.percent + '%';
    els.resTime.textContent = 'Время: ' + result.secondsText;

    clearChildren(els.resMistakes);
    var i;
    for (i = 0; i < result.mistakes.length; i++) {
      var mistake = result.mistakes[i];
      var item = document.createElement('li');
      item.textContent = mistake.prompt + ' — вы: ' + mistake.given + ', верно: ' + mistake.answer;
      els.resMistakes.appendChild(item);
    }

    els.bestLine.textContent = best
      ? 'Лучший результат: ' + best.correct + ' из ' + best.total + ', время ' + MT.formatTime(best.seconds)
      : '';

    showScreen('results');
  }

  function quitRound() {
    stopTimer();
    if (round) round.running = false;
    round = null;
    els.answerHint.textContent = '';
    setAnswerDisabled(false);
    showScreen('settings');
  }

  function switchKind(kind) {
    if (kind === activeKind) return;
    if (round && round.running) quitRound();
    settings[activeKind] = readForm();
    saveSettings(activeKind);
    activeKind = kind;
    updateTabs();
    renderSettings(activeKind);
    renderMessages();
    showScreen('settings');
  }

  function onFieldChange() {
    var ok = renderMessages();
    if (ok) {
      settings[activeKind] = readForm();
      saveSettings(activeKind);
    }
  }

  function onProfileChange() {
    var profile = MT.PROFILES[els.profile.value] ? els.profile.value : 'kid';
    var next = MT.applyProfile(readForm(), profile);
    settings[activeKind] = next;
    storageSet(PROFILE_KEY, profile);
    applyTheme(profile);
    saveSettings(activeKind);
    renderSettings(activeKind);
    renderMessages();
  }

  function wireEvents() {
    var fields = [els.from, els.to, els.format, els.answerType, els.roundLength];
    var i;
    for (i = 0; i < fields.length; i++) {
      fields[i].addEventListener('input', onFieldChange);
      fields[i].addEventListener('change', onFieldChange);
    }

    els.profile.addEventListener('change', onProfileChange);
    els.startBtn.addEventListener('click', startRound);
    els.quitBtn.addEventListener('click', quitRound);
    els.againBtn.addEventListener('click', startRound);
    els.settingsBtn.addEventListener('click', quitRound);

    els.answerSubmit.addEventListener('click', function () {
      submitAnswer(els.answerInput.value);
    });

    els.answerInput.addEventListener('input', function () {
      els.answerInput.value = String(els.answerInput.value).replace(/\D/g, '');
    });

    els.answerInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitAnswer(els.answerInput.value);
      }
    });

    els.tabs.square.addEventListener('click', function () { switchKind('square'); });
    els.tabs.cube.addEventListener('click', function () { switchKind('cube'); });
  }

  function init() {
    settings.square = loadSettings('square');
    settings.cube = loadSettings('cube');
    els.profile.value = settings[activeKind].profile;
    applyTheme(settings[activeKind].profile);
    updateTabs();
    renderSettings(activeKind);
    renderMessages();
    showScreen('settings');
    wireEvents();
  }

  window.MTApp = {
    init: init,
    startRound: startRound,
    submitAnswer: submitAnswer,
    quitRound: quitRound,
    switchKind: switchKind,
    onFieldChange: onFieldChange,
    onProfileChange: onProfileChange,
    renderMessages: renderMessages,
    getState: function () {
      return { activeKind: activeKind, settings: settings, round: round };
    }
  };

  init();
})();
