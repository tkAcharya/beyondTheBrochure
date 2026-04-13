document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('destination-input');
  const btn = document.getElementById('analyze-btn');
  const loading = document.getElementById('loading');
  const loadingMsg = document.getElementById('loading-message');
  const loadingPct = document.getElementById('loading-percentage');
  const results = document.getElementById('results');
  const errorMsg = document.getElementById('error-message');
  const tabsContainer = document.getElementById('tabs-container');

  // Fields
  const resSmiley = document.getElementById('res-smiley');
  const resVerdict = document.getElementById('res-verdict');
  const resSentiments = document.getElementById('res-sentiments');
  const resTruths = document.getElementById('res-truths');
  const resRisks = document.getElementById('res-risks');
  const resBudget = document.getElementById('res-budget');
  const resTips = document.getElementById('res-tips');
  const resStaycations = document.getElementById('res-staycations');

  const refList = document.getElementById('references-list');

  // Tabs logic
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));
      
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.remove('hidden');
    });
  });

  const analyzeDestination = async () => {
    const destination = input.value.trim();
    if (!destination) return;

    // UI State
    errorMsg.classList.add('hidden');
    results.classList.add('hidden');
    tabsContainer.classList.add('hidden');
    loading.classList.remove('hidden');
    btn.disabled = true;
    loadingPct.textContent = '0%';
    loadingMsg.textContent = 'Initializing...';
    refList.innerHTML = '';

    try {
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destination })
      });

      if (!response.ok) {
         const errData = await response.json();
         throw new Error(errData.detail || 'Internal Server Error fetching analysis.');
      }

      // Stream Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let buffer = "";

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
          
          if (data.error) {
              throw new Error(data.error);
          }

          if (data.type === 'progress') {
              loadingPct.textContent = `${data.percent}%`;
              loadingMsg.textContent = data.message;
          } else if (data.type === 'complete') {
              // Final payload
              const res = data.result;
              resSmiley.textContent = res.smiley || '';
              resVerdict.textContent = res.blunt_summary_verdict || '';
              resSentiments.textContent = res.user_sentiments || '';
              resTruths.textContent = res.hidden_truths || '';
              resRisks.textContent = res.monsoon_risks || '';
              resBudget.textContent = res.realistic_budget_breakdowns || '';
              resTips.textContent = res.off_radar_tips || '';
              resStaycations.textContent = res.staycation_recommendations || '';

              // Populate References
              const references = data.references || [];
              references.forEach(ref => {
                 const card = document.createElement('div');
                 card.className = 'reference-card';
                 card.innerHTML = `
                    <div class="ref-header">
                        <span>${ref.name}</span>
                    </div>
                    <span class="ref-url">${ref.url}</span>
                    <div class="ref-rating-container hidden"></div>
                 `;
                 
                 card.addEventListener('click', async () => {
                     const ratingContainer = card.querySelector('.ref-rating-container');
                     if (!ratingContainer.classList.contains('hidden')) return; // Already loaded or loading
                     
                     ratingContainer.classList.remove('hidden');
                     ratingContainer.innerHTML = '<span class="ref-loader"></span> Asking Gemini to rate...';
                     
                     try {
                         const rateRes = await fetch('http://127.0.0.1:8000/rate-reference', {
                             method: 'POST',
                             headers: {
                                 'Content-Type': 'application/json'
                             },
                             body: JSON.stringify({
                                 reference_url: ref.url,
                                 reference_text: ref.content_snippet || ""
                             })
                         });
                         const rateData = await rateRes.json();
                         ratingContainer.innerHTML = `<span class="rating-badge">${rateData.rating}</span> ${rateData.reason}`;
                     } catch (e) {
                         ratingContainer.innerHTML = `<span style="color: #ef4444;">Failed to rate.</span>`;
                     }
                 });

                 refList.appendChild(card);
              });

              // Show results
              results.classList.remove('hidden');
              tabsContainer.classList.remove('hidden');
              
              // Switch to Analysis tab by default
              tabBtns[0].click();
          }
        }
      }

    } catch (error) {
      errorMsg.textContent = `Error: ${error.message}`;
      errorMsg.classList.remove('hidden');
    } finally {
      loading.classList.add('hidden');
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', analyzeDestination);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeDestination();
    }
  });

  // Try to autofill destination based on current tab's generic travel context
  try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        const title = tabs[0].title.toLowerCase();
        // Naively extract a possible destination name from common title patterns
        const match = title.match(/in\s+([a-zA-Z\s]+)/i);
      });
  } catch (e) {
      // In case we are testing without chrome extension environment
  }
});
