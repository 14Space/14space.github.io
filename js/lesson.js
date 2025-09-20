// js/lesson.js

// Оборачиваем весь код в этот обработчик
document.addEventListener('DOMContentLoaded', function() {
  // ====== краткие утилиты ======
  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);
  const lessonId = params.get('lesson') || 'italian';

  const titleEl = $('#lesson-title');
  const explainEl = $('#explain');
  const statusEl = $('#status');
  const btnReset = $('#btn-reset');
  const btnHint = $('#btn-hint');
  const btnPractice = $('#btn-practice');

  // ====== состояние ======
  let LESSON = null;
  let stepIndex = 0;
  let inPractice = false;
  let game = new Chess();
  let board = null;

  // ====== рисуем доску ======
  // Теперь этот код выполнится, когда #board точно существует
  board = Chessboard('board', {
    draggable: true,
    position: 'start',
    onDragStart,
    onDrop,
    onSnapEnd: () => board.position(game.fen())
  });

  renderStatus('Ожидаю данные урока…');

  // ====== грузим JSON урока ======
  fetch(`lessons/${lessonId}.json`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Не найден файл урока')))
    .then(initLesson)
    .catch((e) => {
      explainEl.innerHTML = 'Ошибка загрузки урока. Проверь файл <code>lessons/' + lessonId + '.json</code>.';
      renderStatus(String(e), false);
    });

  // ====== инициализация урока ======
  function initLesson(data) {
    LESSON = data;
    titleEl.textContent = data.title || 'Урок';
    stepIndex = 0;
    inPractice = false;
    btnPractice.disabled = true;

    game.reset();
    if (data.startingFEN && data.startingFEN !== 'start') game.load(data.startingFEN);
    board.position(game.fen());

    renderExplain();
    renderStatus('Урок загружен. Сделай первый ход.');
  }

  // ====== callbacks доски ======
  function onDragStart(source, piece) {
    const turn = game.turn();
    if (turn === 'w' && piece.startsWith('b')) return false;
    if (turn === 'b' && piece.startsWith('w')) return false;

    if (!inPractice && LESSON) {
      const step = LESSON.sequence[stepIndex];
      if (!step || !step.move) return false;
    }
  }

  function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (!move) return 'snapback';

    if (!inPractice) {
      const step = LESSON?.sequence[stepIndex];
      if (!step || !step.move) {
        game.undo();
        return 'snapback';
      }
      if (move.san !== step.move) {
        game.undo();
        explainEl.innerHTML = step.hint
          ? `<b>Подсказка:</b> ${step.hint}`
          : `Неверно. Здесь правильный ход — <b>${step.move}</b>.`;
        renderStatus(`Ожидалось ${step.move}`, false);
        return 'snapback';
      }
      stepIndex++;
      renderStatus(`Верно: ${move.san}`, true);
      renderExplain();
      setTimeout(playOpponentIfAny, 300);
      return;
    }

    const i = LESSON.practiceCursor;
    const expected = LESSON.practice.target[i];
    const shouldBeMyMove = i % 2 === 0;
    if (shouldBeMyMove && move.san !== expected) {
      game.undo();
      renderStatus(`Ожидалось: ${expected}`, false);
      return 'snapback';
    }
    LESSON.practiceCursor++;
    renderStatus(`Ход: ${move.san}`, true);
    setTimeout(playPracticeOpponent, 250);
  }

  function playOpponentIfAny() {
    const step = LESSON.sequence[stepIndex];
    if (step && step.opponent) {
      const mv = game.move(step.opponent);
      if (mv) {
        board.position(game.fen());
        renderStatus(`Соперник: ${mv.san}`, true);
        stepIndex++;
        renderExplain();
      }
    }
    if (stepIndex >= LESSON.sequence.length) {
      btnPractice.disabled = false;
      renderStatus('Основная линия пройдена. Запусти «Сыграть без помощи».', true);
    }
  }

  function playPracticeOpponent() {
    const i = LESSON.practiceCursor;
    if (i < LESSON.practice.target.length && i % 2 === 1) {
      const mvSan = LESSON.practice.target[i];
      const mv = game.move(mvSan);
      if (mv) {
        LESSON.practiceCursor++;
        board.position(game.fen());
        renderStatus(`Соперник: ${mv.san}`, true);
      }
      if (LESSON.practiceCursor >= LESSON.practice.target.length) {
        renderStatus('Практика завершена! 🎉', true);
        explainEl.innerHTML = 'Отлично! Можешь повторить ещё раз или вернуться на главную.';
      }
    }
  }

  // ====== UI ======
  function renderExplain() {
    const step = LESSON.sequence[stepIndex];
    if (!step) {
      explainEl.innerHTML = 'Основная линия завершена. Нажми «Сыграть без помощи».';
      return;
    }
    explainEl.innerHTML = step.explain || 'Сделай правильный ход.';
    board.position(game.fen());
  }

  function renderStatus(text, ok = null) {
    const li = document.createElement('li');
    li.textContent = text;
    if (ok === true) li.classList.add('ok');
    if (ok === false) li.classList.add('bad');
    statusEl.prepend(li);
  }

  // кнопки
  btnReset.addEventListener('click', () => {
    if (!LESSON) return;
    inPractice = false;
    btnPractice.disabled = true;
    statusEl.innerHTML = '';
    game.reset();
    if (LESSON.startingFEN && LESSON.startingFEN !== 'start') game.load(LESSON.startingFEN);
    board.position(game.fen());
    stepIndex = 0;
    renderExplain();
    renderStatus('Позиция сброшена.');
  });

  btnHint.addEventListener('click', () => {
    if (inPractice || !LESSON) return;
    const step = LESSON.sequence[stepIndex];
    if (step?.move) {
      explainEl.innerHTML = `<b>Подсказка:</b> ищем ход <code>${step.move}</code> — идея описана выше.`;
    }
  });

  btnPractice.addEventListener('click', () => {
    if (!LESSON) return;
    inPractice = true;
    statusEl.innerHTML = '';
    explainEl.innerHTML = 'Практика: воспроизведи линию без подсказок.';
    game.reset();
    if (LESSON.startingFEN && LESSON.startingFEN !== 'start') game.load(LESSON.startingFEN);
    board.position(game.fen());
    LESSON.practiceCursor = 0;
  });

}); // <-- не забудь закрыть скобку обработчика