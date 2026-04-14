const API_BASE = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {

  // ─── DOM REFS ───────────────────────────────────────────────────────────────
  const input       = document.getElementById('destination-input');
  const btn         = document.getElementById('analyze-btn');
  const results     = document.getElementById('results');
  const errorMsg    = document.getElementById('error-message');
  const tabsContainer = document.getElementById('tabs-container');
  const refList     = document.getElementById('references-list');

  // Analysis fields
  const resSmiley      = document.getElementById('res-smiley');
  const resVerdict     = document.getElementById('res-verdict');
  const resSentiments  = document.getElementById('res-sentiments');
  const resTruths      = document.getElementById('res-truths');
  const resRisks       = document.getElementById('res-risks');
  const resBudget      = document.getElementById('res-budget');
  const resTips        = document.getElementById('res-tips');
  const resStaycations = document.getElementById('res-staycations');

  // Loading states
  const loadingStates  = document.querySelectorAll('.loading-state');
  const loadingPcts    = document.querySelectorAll('.loading-percentage');
  const loadingMsgs    = document.querySelectorAll('.loading-message');

  // Plan tab
  const genBtn        = document.getElementById('gen-itinerary-btn');
  const itinOutput    = document.getElementById('itinerary-output');
  const daysSelect    = document.getElementById('itin-days');
  const styleSelect   = document.getElementById('itin-style');
  const travelersSelect = document.getElementById('itin-travelers');
  const focusSelect   = document.getElementById('itin-focus');

  // Book tab
  const bookLinks     = document.getElementById('book-links');

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let lastAnalysisResult = null;
  let lastDestination    = '';

  // History from localStorage (extension storage fallback)
  let history = [];
  try {
    const stored = localStorage.getItem('btb_history');
    if (stored) history = JSON.parse(stored);
  } catch (_) {}

  // ─── TABS ──────────────────────────────────────────────────────────────────
  const tabBtns     = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(tb => {
    tb.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));
      tb.classList.add('active');
      const targetContent = document.getElementById(tb.dataset.tab);
      if (targetContent) targetContent.classList.remove('hidden');
    });
  });

  // ─── EXPANDABLE CARDS ──────────────────────────────────────────────────────
  document.querySelectorAll('.card-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const card = e.target.closest('.card.expandable');
      const body = card.querySelector('.card-body');
      const btn = header.querySelector('.expand-btn');
      if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        if (btn) btn.textContent = '▲';
      } else {
        body.classList.add('hidden');
        if (btn) btn.textContent = '▼';
      }
    });
  });

  // ─── HISTORY CHIPS ─────────────────────────────────────────────────────────
  function renderHistory() {
    const container = document.getElementById('history-chips');
    if (!container) return;
    container.innerHTML = '';
    if (history.length === 0) { container.parentElement?.classList.add('hidden'); return; }
    container.parentElement?.classList.remove('hidden');
    history.slice(0, 4).forEach(dest => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = dest;
      chip.addEventListener('click', () => {
        input.value = dest;
        analyzeDestination();
      });
      container.appendChild(chip);
    });
  }

  function addToHistory(dest) {
    history = [dest, ...history.filter(d => d.toLowerCase() !== dest.toLowerCase())].slice(0, 6);
    try { localStorage.setItem('btb_history', JSON.stringify(history)); } catch (_) {}
    renderHistory();
  }

  renderHistory();

  // ─── SHARE VERDICT ─────────────────────────────────────────────────────────
  const shareBtn = document.getElementById('share-verdict-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      if (!lastAnalysisResult) return;
      const r = lastAnalysisResult;
      const text = `${r.smiley || '✈️'} ${lastDestination}\n\n"${r.blunt_summary_verdict}"\n\n— Beyond The Brochure`;
      navigator.clipboard?.writeText(text).then(() => {
        shareBtn.textContent = '✅ Copied!';
        setTimeout(() => { shareBtn.textContent = '📋 Share verdict'; }, 2000);
      }).catch(() => alert(text));
    });
  }

  // ─── PARTNER LINKS (Book tab) ───────────────────────────────────────────────
  async function loadPartnerLinks(destination) {
    if (!bookLinks) return;
    bookLinks.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading booking links…</p>';

    try {
      const res  = await fetch(`${API_BASE}/partner-links?destination=${encodeURIComponent(destination)}`);
      const data = await res.json();

      bookLinks.innerHTML = `
        <div class="partner-section-title">✈️ Flights</div>
        ${partnerCard('Skyscanner', 'Compare 500+ airlines · Best price guarantee', data.flights.skyscanner, '✈️', 'Best prices')}
        ${partnerCard('Google Flights', 'Price calendar · Set fare alerts', data.flights.google_flights, '🔍', 'Fare alerts')}

        <div class="partner-section-title">🏨 Accommodation</div>
        ${partnerCard('Booking.com', 'Hotels & apartments · Free cancellation', data.accommodation.booking_com, '🏨', 'Free cancel')}
        ${partnerCard('Airbnb', 'Local apartments and unique stays', data.accommodation.airbnb, '🏠', 'Local feel')}
        ${partnerCard('Hostelworld', 'Budget beds · Capsule hotels', data.accommodation.hostelworld, '🎒', 'Budget')}

        <div class="partner-section-title">🎟️ Activities</div>
        ${partnerCard('GetYourGuide', 'Skip-the-line tickets · Local experiences', data.activities.getyourguide, '🎫', 'Vetted')}
        ${partnerCard('Viator', 'Day trips · Small group tours', data.activities.viator, '🗺️', 'Day trips')}

        <div class="partner-section-title">🚌 Getting Around</div>
        ${partnerCard('Rome2Rio', 'All transport options from/to destination', data.transport.rome2rio, '🚄', 'Routes')}
      `;

      // open links
      bookLinks.querySelectorAll('.partner-card-link').forEach(card => {
        card.addEventListener('click', () => {
          const url = card.dataset.url;
          if (url) chrome.tabs.create({ url });
        });
      });

    } catch (e) {
      bookLinks.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Could not load booking links — is the backend running?</p>';
    }
  }

  function partnerCard(name, desc, url, icon, tag) {
    return `
      <div class="partner-card-link" data-url="${url}" style="cursor:pointer">
        <div class="partner-logo">${icon}</div>
        <div class="partner-info">
          <div class="partner-name">${name}</div>
          <div class="partner-desc">${desc}</div>
        </div>
        <span class="partner-tag">${tag}</span>
        <span class="partner-arrow">›</span>
      </div>
    `;
  }

  // ─── ITINERARY (Plan tab) ───────────────────────────────────────────────────
  if (genBtn) {
    genBtn.addEventListener('click', generateItinerary);
  }

  async function generateItinerary() {
    if (!lastDestination) {
      showError('Please analyze a destination first.');
      return;
    }
    genBtn.disabled = true;
    genBtn.textContent = '⏳ Gemini is planning your trip…';
    itinOutput.innerHTML = '';

    // Build a brief context string from last analysis
    const ctx = lastAnalysisResult
      ? `Hidden truths: ${lastAnalysisResult.hidden_truths || ''}. Budget: ${lastAnalysisResult.realistic_budget_breakdowns || ''}. Off-radar tips: ${lastAnalysisResult.off_radar_tips || ''}.`
      : '';

    try {
      const res = await fetch(`${API_BASE}/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: lastDestination,
          days: parseInt(daysSelect?.value || '5'),
          travel_style: styleSelect?.value || 'moderate',
          travelers: travelersSelect?.value || 'solo',
          focus: focusSelect?.value || 'mixed',
          analysis_context: ctx
        })
      });

      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      renderItinerary(data);

    } catch (e) {
      itinOutput.innerHTML = `<p style="color:#ef4444;font-size:13px;">Failed to generate itinerary. Is the backend running?</p>`;
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = '✨ Regenerate with Gemini';
    }
  }

  function renderItinerary(data) {
    const tagColors = {
      Food: '#fb923c', Culture: '#a78bfa', Insider: '#22d3ee',
      Logistics: '#94a3b8', Nature: '#34d399', Shopping: '#fbbf24'
    };

    let html = `<div class="gemini-badge">✦ Generated by Gemini · ${data.duration_days} days · ${data.travel_style} · ${data.destination}</div>`;

    if (data.headline_tip) {
      html += `<div class="itin-tip-banner">💡 ${data.headline_tip}</div>`;
    }

    (data.days || []).forEach(day => {
      html += `
        <div class="day-block">
          <div class="day-header">
            <div class="day-num">${day.day}</div>
            <div>
              <div class="day-title">${escHtml(day.theme || `Day ${day.day}`)}</div>
              <div class="day-subtitle">${escHtml(day.areas || '')}</div>
            </div>
          </div>
          <div class="day-body">
            ${(day.activities || []).map(act => {
              const color = tagColors[act.tag] || '#94a3b8';
              return `
                <div class="activity">
                  <div class="activity-time">${escHtml(act.time || '')}</div>
                  <div>
                    <div class="activity-name">${escHtml(act.name || '')}</div>
                    <div class="activity-note">${escHtml(act.note || '')}</div>
                    ${act.tag ? `<span class="activity-tag" style="background:${color}22;border-color:${color}44;color:${color}">${escHtml(act.tag)}</span>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      `;
    });

    if (data.budget_summary) {
      const b = data.budget_summary;
      html += `
        <div class="budget-summary-card">
          <div class="card-title">💸 Budget Summary</div>
          <div class="bsum-row"><span>Daily estimate</span><strong>${escHtml(b.daily_estimate || '')}</strong></div>
          <div class="bsum-row warn"><span>⚠️ Biggest trap</span><span>${escHtml(b.biggest_trap || '')}</span></div>
          <div class="bsum-row"><span>💡 Money tip</span><span>${escHtml(b.money_saving_tip || '')}</span></div>
        </div>
      `;
    }

    itinOutput.innerHTML = html;
  }

  // ─── MAIN ANALYZE ──────────────────────────────────────────────────────────
  const analyzeDestination = async () => {
    const destination = input.value.trim();
    if (!destination) return;
    lastDestination = destination;

    // Reset UI
    errorMsg.classList.add('hidden');
    results.classList.remove('hidden');
    document.querySelectorAll('.tab-body').forEach(tb => tb.classList.add('hidden'));
    tabsContainer.classList.add('hidden');
    loadingStates.forEach(l => l.classList.remove('hidden'));
    loadingPcts.forEach(p => p.textContent = '0%');
    loadingMsgs.forEach(m => m.textContent = 'Initializing…');
    btn.disabled = true;
    refList.innerHTML = '';
    if (itinOutput) itinOutput.innerHTML = '';
    if (bookLinks) bookLinks.innerHTML = '';

    try {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Internal server error.');
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf('\n');

        while (boundary !== -1) {
          const line = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 1);
          boundary = buffer.indexOf('\n');
          if (!line) continue;

          const data = JSON.parse(line);
          if (data.error) throw new Error(data.error);

          if (data.type === 'progress') {
            loadingPcts.forEach(p => p.textContent = `${data.percent}%`);
            loadingMsgs.forEach(m => m.textContent = data.message);

          } else if (data.type === 'complete') {
            try { 
              localStorage.setItem('btb_last_result', JSON.stringify({ data, destination })); 
            } catch (e) {}
            renderAnalysisData(data, destination);
          }
        }
      }

    } catch (error) {
      errorMsg.textContent = `Error: ${error.message}`;
      errorMsg.classList.remove('hidden');
    } finally {
      loadingStates.forEach(l => l.classList.add('hidden'));
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', analyzeDestination);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') analyzeDestination(); });

  function renderAnalysisData(data, destination) {
    const res = data.result;
    lastAnalysisResult = res;
    lastDestination = destination;
    input.value = destination;

    resSmiley.textContent      = res.smiley || '';
    document.getElementById('res-score').textContent = res.score ? `${res.score}/100` : '';
    resVerdict.textContent     = res.blunt_summary_verdict || '';
    resSentiments.textContent  = res.user_sentiments || '';
    resTruths.textContent      = res.hidden_truths || '';
    resRisks.textContent       = res.monsoon_risks || '';
    resBudget.textContent      = res.realistic_budget_breakdowns || '';
    resTips.textContent        = res.off_radar_tips || '';
    resStaycations.textContent = res.staycation_recommendations || '';

    // Sentiment Bars
    const sentContainer = document.getElementById('sentiment-bars-container');
    sentContainer.innerHTML = '';
    if (res.sentiment_bars) {
      const labels = { love: 'Love it', expensive: 'Pricy', crowded: 'Crowded', return_trip: 'Would return' };
      for (const [k, v] of Object.entries(res.sentiment_bars)) {
        let color = k === 'love' || k === 'return_trip' ? '#10b981' : '#f43f5e';
        sentContainer.innerHTML += `
          <div class="bar-row">
            <div class="bar-label">${escHtml(labels[k] || k)}</div>
            <div class="bar-bg"><div class="bar-fill" style="width: ${escHtml(v)}%; background: ${color}"></div></div>
            <div class="bar-val">${escHtml(v)}%</div>
          </div>
        `;
      }
    }

    // Heatmap
    const heatContainer = document.getElementById('heatmap-container');
    heatContainer.innerHTML = '';
    if (res.best_time_heatmap) {
      res.best_time_heatmap.forEach(m => {
        let heatColor = '#10b981'; // green
        if (m.score < 50) heatColor = '#ef4444'; // red
        else if (m.score < 75) heatColor = '#eab308'; // yellow
        heatContainer.innerHTML += `
          <div class="heat-month">
            <div class="heat-bar" style="height: ${escHtml(Math.max(4, m.score))}%; background: ${heatColor}"></div>
            <div class="heat-label">${escHtml(m.month[0])}</div>
          </div>
        `;
      });
    }

    // Budget Grid
    const budgetGrid = document.getElementById('budget-grid');
    budgetGrid.innerHTML = '';
    if (res.budget_grid) {
      for (const [k, v] of Object.entries(res.budget_grid)) {
        budgetGrid.innerHTML += `
          <div class="budget-item">
            <div class="budget-label">${escHtml(k)}</div>
            <div class="budget-val">$${escHtml(v)}</div>
          </div>
        `;
      }
    }

    const tipsTags = document.getElementById('tips-tags');
    if (tipsTags) tipsTags.innerHTML = `<span class="tag-pill">Non-cliché</span><span class="tag-pill">Local</span>`;
    const stayTags = document.getElementById('staycation-tags');
    if (stayTags) stayTags.innerHTML = `<span class="tag-pill">Getaway</span><span class="tag-pill">Hidden</span>`;

    const references = data.references || [];
    refList.innerHTML = '';
    
    if (references.length === 0) {
      refList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;">No direct references were successfully scraped regarding this destination.</p>';
    } else {
      references.forEach(ref => {
        const card = document.createElement('div');
        card.className = 'reference-card';
        card.innerHTML = `
          <div class="ref-header"><span>${escHtml(ref.name)}</span></div>
          <span class="ref-url">${escHtml(ref.url)}</span>
          <div class="ref-rating-container hidden"></div>
        `;
        card.addEventListener('click', async () => {
          const ratingContainer = card.querySelector('.ref-rating-container');
          if (!ratingContainer.classList.contains('hidden')) return;
          ratingContainer.classList.remove('hidden');
          ratingContainer.innerHTML = '<span class="ref-loader"></span> Asking Gemini to rate…';
          try {
            const rateRes  = await fetch(`${API_BASE}/rate-reference`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference_url: ref.url, reference_text: ref.content_snippet || '' })
            });
            const rateData = await rateRes.json();
            ratingContainer.innerHTML = `<span class="rating-badge">${escHtml(rateData.rating)}</span> ${escHtml(rateData.reason)}`;
          } catch (e) {
            ratingContainer.innerHTML = `<span style="color:#ef4444;">Failed to rate.</span>`;
          }
        });
        refList.appendChild(card);
      });
    }

    // Add ✨ AI badge to headers if not already present
    document.querySelectorAll('.card-header').forEach(header => {
      if (!header.querySelector('.ai-badge')) {
        const aiBadge = document.createElement('span');
        aiBadge.className = 'ai-badge';
        aiBadge.innerHTML = '✨ AI';
        // insert before the expand-btn
        const expandBtn = header.querySelector('.expand-btn');
        if (expandBtn) {
           header.insertBefore(aiBadge, expandBtn);
        }
      }
    });

    loadPartnerLinks(destination);
    addToHistory(destination);

    loadingStates.forEach(l => l.classList.add('hidden'));
    results.classList.remove('hidden');
    tabsContainer.classList.remove('hidden');
    document.querySelectorAll('.tab-body').forEach(tb => tb.classList.remove('hidden'));
    tabBtns[0].click();
  }

  // Load from local storage immediately if available
  try {
    const saved = localStorage.getItem('btb_last_result');
    if (saved) {
      const p = JSON.parse(saved);
      if (p.data && p.destination) {
        renderAnalysisData(p.data, p.destination);
      }
    }
  } catch (e) {}

  // Auto-fill from active tab title
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length) return;
      const title = tabs[0].title.toLowerCase();
      const match = title.match(/in\s+([a-zA-Z\s]+)/i);
      if (match && input.value === '') input.value = match[1].trim();
    });
  } catch (_) {}

  // ─── UTILITY ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    setTimeout(() => errorMsg.classList.add('hidden'), 4000);
  }
});
