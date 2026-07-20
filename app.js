(() => {
  'use strict';

  const STORAGE_KEY = 'one-device-vote-session-v1';

  const app = document.getElementById('app');
  const homeButton = document.getElementById('homeButton');
  const resetButton = document.getElementById('resetButton');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNumber = document.getElementById('countdownNumber');
  const countdownMessage = document.getElementById('countdownMessage');

  const initialState = () => ({
    screen: 'home',
    survey: {
      title: '',
      candidates: ['', ''],
      voterCount: 1,
    },
    votes: {},
    currentVoter: 0,
    revealed: false,
  });

  let state = loadState();
  let voteLocked = false;

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState();
      const parsed = JSON.parse(raw);
      return {
        ...initialState(),
        ...parsed,
        survey: {
          ...initialState().survey,
          ...(parsed.survey || {}),
        },
      };
    } catch (error) {
      console.warn('저장된 세션을 불러오지 못했습니다.', error);
      return initialState();
    }
  }

  function saveState() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setScreen(screen) {
    state.screen = screen;
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function showToast(message) {
    document.querySelector('.toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  function updateTopbar() {
    const atHome = state.screen === 'home';
    homeButton.classList.toggle('is-hidden', atHome);
    resetButton.classList.toggle('is-hidden', atHome || state.screen === 'create');
  }

  function render() {
    updateTopbar();
    const renderers = {
      home: renderHome,
      create: renderCreate,
      vote: renderVote,
      waiting: renderWaiting,
      result: renderResult,
    };
    (renderers[state.screen] || renderHome)();
  }

  function renderHome() {
    app.innerHTML = `
      <section class="screen hero">
        <div class="hero-mark" aria-hidden="true">✓</div>
        <div>
          <h1>한 기기로<br>빠르게 투표</h1>
          <p>후보를 만들고, 기기를 돌려가며 익명으로 투표한 뒤<br>현장에서 바로 결과를 공개하세요.</p>
        </div>
        <button id="createSurveyButton" class="primary-button" type="button">설문 만들기</button>
      </section>
    `;

    document.getElementById('createSurveyButton').addEventListener('click', () => {
      state = initialState();
      state.screen = 'create';
      saveState();
      render();
    });
  }

  function renderCreate() {
    const candidateRows = state.survey.candidates.map((candidate, index) => `
      <div class="candidate-input-row" data-index="${index}">
        <span class="candidate-index">${index + 1}</span>
        <input
          class="text-input candidate-name-input"
          type="text"
          maxlength="40"
          placeholder="후보 이름"
          value="${escapeHtml(candidate)}"
          aria-label="후보 ${index + 1} 이름"
        />
        <button class="remove-button" type="button" aria-label="후보 ${index + 1} 삭제" ${state.survey.candidates.length <= 2 ? 'disabled' : ''}>×</button>
      </div>
    `).join('');

    app.innerHTML = `
      <section class="screen">
        <h1 class="screen-title">설문 만들기</h1>
        <p class="screen-subtitle">최소 2명의 후보와 투표자 수를 입력하세요.</p>

        <form id="surveyForm" class="card" novalidate>
          <div class="field">
            <label class="field-label" for="surveyTitle">설문 타이틀</label>
            <input id="surveyTitle" class="text-input" type="text" maxlength="60" placeholder="예: 오늘의 발표 1등은?" value="${escapeHtml(state.survey.title)}" />
          </div>

          <div class="field">
            <div class="field-label">
              <span>후보</span>
              <small>${state.survey.candidates.length}명</small>
            </div>
            <div id="candidateInputList" class="candidate-input-list">${candidateRows}</div>
            <button id="addCandidateButton" class="add-button" type="button">＋ 후보 추가</button>
          </div>

          <div class="field">
            <label class="field-label" for="voterCount">
              <span>투표자 수</span>
              <small>후보 수와 달라도 됩니다</small>
            </label>
            <input id="voterCount" class="number-input" type="number" inputmode="numeric" min="1" max="999" value="${state.survey.voterCount}" />
          </div>

          <div class="form-actions">
            <button class="primary-button" type="submit">설문 진행</button>
          </div>
        </form>
      </section>
    `;

    const titleInput = document.getElementById('surveyTitle');
    const voterCountInput = document.getElementById('voterCount');

    titleInput.addEventListener('input', (event) => {
      state.survey.title = event.target.value;
      saveState();
    });

    voterCountInput.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      state.survey.voterCount = Number.isFinite(value) ? value : 1;
      saveState();
    });

    document.querySelectorAll('.candidate-name-input').forEach((input) => {
      input.addEventListener('input', (event) => {
        const index = Number(event.target.closest('.candidate-input-row').dataset.index);
        state.survey.candidates[index] = event.target.value;
        saveState();
      });
    });

    document.querySelectorAll('.remove-button').forEach((button) => {
      button.addEventListener('click', (event) => {
        const index = Number(event.target.closest('.candidate-input-row').dataset.index);
        state.survey.candidates.splice(index, 1);
        saveState();
        renderCreate();
      });
    });

    document.getElementById('addCandidateButton').addEventListener('click', () => {
      if (state.survey.candidates.length >= 30) {
        showToast('후보는 최대 30명까지 추가할 수 있습니다.');
        return;
      }
      state.survey.candidates.push('');
      saveState();
      renderCreate();
      const inputs = document.querySelectorAll('.candidate-name-input');
      inputs[inputs.length - 1]?.focus();
    });

    document.getElementById('surveyForm').addEventListener('submit', (event) => {
      event.preventDefault();
      startSurvey();
    });
  }

  function startSurvey() {
    const title = state.survey.title.trim();
    const candidates = state.survey.candidates.map((name) => name.trim());
    const voterCount = Math.floor(Number(state.survey.voterCount));

    if (!title) {
      showToast('설문 타이틀을 입력하세요.');
      document.getElementById('surveyTitle')?.focus();
      return;
    }

    if (candidates.some((name) => !name)) {
      showToast('빈 후보 이름을 모두 입력하세요.');
      document.querySelector('.candidate-name-input[value=""]')?.focus();
      return;
    }

    const uniqueNames = new Set(candidates.map((name) => name.toLocaleLowerCase('ko-KR')));
    if (uniqueNames.size !== candidates.length) {
      showToast('후보 이름은 서로 다르게 입력하세요.');
      return;
    }

    if (!Number.isInteger(voterCount) || voterCount < 1 || voterCount > 999) {
      showToast('투표자 수는 1~999명으로 입력하세요.');
      document.getElementById('voterCount')?.focus();
      return;
    }

    state.survey = { title, candidates, voterCount };
    state.votes = Object.fromEntries(candidates.map((name) => [name, 0]));
    state.currentVoter = 0;
    state.revealed = false;
    setScreen('vote');
  }

  function renderVote() {
    if (!state.survey.candidates.length || !Object.keys(state.votes).length) {
      state = initialState();
      setScreen('home');
      return;
    }

    const shuffledCandidates = shuffle(state.survey.candidates);
    const voterNumber = state.currentVoter + 1;
    const progress = Math.round((state.currentVoter / state.survey.voterCount) * 100);

    app.innerHTML = `
      <section class="screen">
        <h1 class="screen-title">${escapeHtml(state.survey.title)}</h1>
        <div class="progress-wrap">
          <div class="progress-meta">
            <span>${voterNumber}번째 투표자</span>
            <span>${state.currentVoter} / ${state.survey.voterCount} 완료</span>
          </div>
          <div class="progress-bar" aria-label="투표 진행률">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
        <p class="vote-instruction">마음에 드는 후보 하나를 누르세요.<br>선택하면 바로 확정되며 되돌릴 수 없습니다.</p>
        <div class="candidate-grid">
          ${shuffledCandidates.map((candidate) => `
            <button class="candidate-card" type="button" data-candidate="${escapeHtml(candidate)}">${escapeHtml(candidate)}</button>
          `).join('')}
        </div>
      </section>
    `;

    document.querySelectorAll('.candidate-card').forEach((button) => {
      button.addEventListener('click', () => castVote(button.dataset.candidate));
    });
  }

  function castVote(candidate) {
    if (voteLocked || !(candidate in state.votes)) return;
    voteLocked = true;
    state.votes[candidate] += 1;
    state.currentVoter += 1;
    saveState();
    runCountdown();
  }

  function runCountdown() {
    let remaining = 3;
    countdownNumber.textContent = String(remaining);
    countdownMessage.textContent = state.currentVoter >= state.survey.voterCount
      ? '모든 투표가 끝났습니다'
      : '다음 사람에게 기기를 넘겨주세요';
    countdownOverlay.classList.remove('is-hidden');

    const timer = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        countdownNumber.textContent = String(remaining);
        return;
      }

      window.clearInterval(timer);
      countdownOverlay.classList.add('is-hidden');
      voteLocked = false;

      if (state.currentVoter >= state.survey.voterCount) {
        setScreen('waiting');
      } else {
        renderVote();
      }
    }, 1000);
  }

  function renderWaiting() {
    app.innerHTML = `
      <section class="screen waiting">
        <div class="waiting-emoji" aria-hidden="true">🔒</div>
        <div>
          <h1 class="screen-title">투표 완료</h1>
          <p class="screen-subtitle">${state.survey.voterCount}명의 투표가 모두 끝났습니다.<br>준비되면 결과를 공개하세요.</p>
        </div>
        <button id="revealButton" class="primary-button" type="button">결과 공개</button>
      </section>
    `;

    document.getElementById('revealButton').addEventListener('click', () => {
      state.revealed = true;
      setScreen('result');
    });
  }

  function getRankedResults() {
    const sorted = Object.entries(state.votes)
      .map(([name, votes]) => ({ name, votes }))
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'ko'));

    let lastVotes = null;
    let lastRank = 0;
    return sorted.map((item, index) => {
      if (item.votes !== lastVotes) {
        lastRank = index + 1;
        lastVotes = item.votes;
      }
      return { ...item, rank: lastRank };
    });
  }

  function rankLabel(item) {
    if (item.rank === 1) return '👑';
    return `${item.rank}위`;
  }

  function renderResult() {
    const results = getRankedResults();
    const total = state.survey.voterCount;

    app.innerHTML = `
      <section class="screen">
        <div id="resultCapture" class="result-capture">
          <header class="result-header">
            <div class="eyebrow">FINAL RESULT</div>
            <h1>${escapeHtml(state.survey.title)}</h1>
            <p>총 ${total}명 참여</p>
          </header>

          <div class="result-list">
            ${results.map((item) => {
              const percentage = total > 0 ? Math.round((item.votes / total) * 100) : 0;
              return `
                <article class="result-row rank-${Math.min(item.rank, 4)}">
                  <div class="rank-badge">${rankLabel(item)}</div>
                  <div class="result-name">${escapeHtml(item.name)}</div>
                  <div class="result-votes">${item.votes}표<small>${percentage}%</small></div>
                </article>
              `;
            }).join('')}
          </div>
        </div>

        <div class="result-actions">
          <button id="saveResultButton" class="primary-button" type="button">결과 저장</button>
          <button id="newSurveyButton" class="secondary-button" type="button">새 설문 만들기</button>
        </div>
      </section>
    `;

    document.getElementById('saveResultButton').addEventListener('click', saveResultImage);
    document.getElementById('newSurveyButton').addEventListener('click', resetApp);
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
    const chars = [...String(text)];
    const lines = [];
    let current = '';

    for (const char of chars) {
      const next = current + char;
      if (ctx.measureText(next).width <= maxWidth || !current) {
        current = next;
      } else {
        lines.push(current);
        current = char;
        if (lines.length >= maxLines - 1) break;
      }
    }

    const consumed = lines.join('').length + current.length;
    if (current && lines.length < maxLines) lines.push(current);

    if (consumed < chars.length && lines.length) {
      let last = lines[lines.length - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = `${last}…`;
    }

    return lines;
  }

  function fitCanvasText(ctx, text, maxWidth) {
    const raw = String(text);
    if (ctx.measureText(raw).width <= maxWidth) return raw;
    let shortened = raw;
    while (shortened.length > 1 && ctx.measureText(`${shortened}…`).width > maxWidth) {
      shortened = shortened.slice(0, -1);
    }
    return `${shortened}…`;
  }

  function createResultCanvas() {
    const results = getRankedResults();
    const width = 1080;
    const margin = 70;
    const headerHeight = 290;
    const rowHeight = 142;
    const rowGap = 22;
    const footer = 80;
    const height = headerHeight + results.length * rowHeight + Math.max(0, results.length - 1) * rowGap + footer;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#f2efff');
    background.addColorStop(0.28, '#ffffff');
    background.addColorStop(1, '#f7f7ff');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, -40, 10, width / 2, 20, 460);
    glow.addColorStop(0, 'rgba(255, 193, 47, 0.36)');
    glow.addColorStop(1, 'rgba(255, 193, 47, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, 520);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5b4bff';
    ctx.font = '900 28px system-ui, -apple-system, sans-serif';
    ctx.fillText('FINAL RESULT', width / 2, 62);

    ctx.fillStyle = '#161827';
    ctx.font = '900 58px system-ui, -apple-system, sans-serif';
    const titleLines = wrapCanvasText(ctx, state.survey.title, width - margin * 2, 2);
    const titleStart = titleLines.length === 1 ? 132 : 112;
    titleLines.forEach((line, index) => {
      ctx.fillText(line, width / 2, titleStart + index * 66);
    });

    ctx.fillStyle = '#6f7387';
    ctx.font = '700 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(`총 ${state.survey.voterCount}명 참여`, width / 2, 236);

    results.forEach((item, index) => {
      const y = headerHeight + index * (rowHeight + rowGap);
      const isFirst = item.rank === 1;
      const isSecond = item.rank === 2;
      const isThird = item.rank === 3;

      ctx.save();
      if (isFirst) {
        ctx.shadowColor = 'rgba(179, 121, 0, 0.20)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 12;
      }

      roundedRectPath(ctx, margin, y, width - margin * 2, rowHeight, 32);
      if (isFirst) {
        const firstGradient = ctx.createLinearGradient(margin, y, width - margin, y + rowHeight);
        firstGradient.addColorStop(0, '#fff3bd');
        firstGradient.addColorStop(1, '#fffdf4');
        ctx.fillStyle = firstGradient;
      } else {
        ctx.fillStyle = '#ffffff';
      }
      ctx.fill();
      ctx.restore();

      roundedRectPath(ctx, margin, y, width - margin * 2, rowHeight, 32);
      ctx.lineWidth = isFirst ? 5 : 3;
      ctx.strokeStyle = isFirst ? '#ffbf2f' : isSecond ? '#aab1c4' : isThird ? '#c98254' : '#e5e7f0';
      ctx.stroke();

      const badgeX = margin + 28;
      const badgeY = y + 27;
      const badgeSize = 88;
      roundedRectPath(ctx, badgeX, badgeY, badgeSize, badgeSize, 25);
      ctx.fillStyle = isFirst ? '#ffbf2f' : isSecond ? '#e2e5ec' : isThird ? '#efd3c1' : '#f0f1f7';
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = isFirst ? '#6d4b00' : isSecond ? '#5d6577' : isThird ? '#70462d' : '#4c5062';
      ctx.font = isFirst
        ? '900 46px system-ui, -apple-system, sans-serif'
        : '900 30px system-ui, -apple-system, sans-serif';
      ctx.fillText(isFirst ? '♛' : `${item.rank}위`, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#161827';
      ctx.font = isFirst
        ? '900 47px system-ui, -apple-system, sans-serif'
        : '900 39px system-ui, -apple-system, sans-serif';
      const nameX = badgeX + badgeSize + 34;
      const voteAreaWidth = 180;
      const nameMaxWidth = width - margin - voteAreaWidth - nameX;
      ctx.fillText(fitCanvasText(ctx, item.name, nameMaxWidth), nameX, y + rowHeight / 2);

      const percentage = state.survey.voterCount > 0
        ? Math.round((item.votes / state.survey.voterCount) * 100)
        : 0;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#161827';
      ctx.font = '900 37px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${item.votes}표`, width - margin - 28, y + 56);
      ctx.fillStyle = '#6f7387';
      ctx.font = '700 24px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${percentage}%`, width - margin - 28, y + 96);
    });

    return canvas;
  }

  async function saveResultImage() {
    const saveButton = document.getElementById('saveResultButton');
    saveButton.disabled = true;
    saveButton.textContent = '이미지 만드는 중…';

    try {
      const canvas = createResultCanvas();
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('이미지 생성 실패')), 'image/png', 1);
      });

      const safeTitle = state.survey.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '투표결과';
      const file = new File([blob], `${safeTitle}.png`, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: state.survey.title,
            text: '투표 결과 이미지',
            files: [file],
          });
          showToast('공유 또는 저장 메뉴를 열었습니다.');
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeTitle}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('결과 이미지를 다운로드했습니다.');
    } catch (error) {
      console.error(error);
      showToast('결과 이미지 저장에 실패했습니다.');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = '결과 저장';
    }
  }

  function resetApp() {
    const confirmed = window.confirm('현재 설문과 투표 결과를 모두 지우고 새로 시작할까요?');
    if (!confirmed) return;
    sessionStorage.removeItem(STORAGE_KEY);
    state = initialState();
    render();
  }

  homeButton.addEventListener('click', () => {
    if (state.screen === 'create') {
      setScreen('home');
      return;
    }

    const confirmed = window.confirm('진행 중인 설문을 나가면 현재 내용이 초기화됩니다. 나갈까요?');
    if (confirmed) {
      sessionStorage.removeItem(STORAGE_KEY);
      state = initialState();
      render();
    }
  });

  resetButton.addEventListener('click', resetApp);

  window.addEventListener('pageshow', () => {
    voteLocked = false;
  });

  render();
})();
