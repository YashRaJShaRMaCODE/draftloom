export function analyzeDraft(text) {
  const words = text.trim().match(/\b[\p{L}\p{N}'’-]+\b/gu) || [];
  const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  const longSentences = sentences.filter((sentence) => (sentence.match(/\b[\p{L}\p{N}'’-]+\b/gu) || []).length > 24);
  const fillerPhrases = ['very', 'really', 'just', 'basically', 'actually', 'in order to', 'i think maybe'];
  const foundFillers = fillerPhrases.filter((phrase) => new RegExp(`\\b${phrase.replaceAll(' ', '\\s+')}\\b`, 'i').test(text));
  return { words: words.length, sentences: sentences.length, longSentences, foundFillers };
}

export function buildEmail({ name, topic, context, ask, tone }) {
  const greeting = tone === 'formal' ? `Dear ${name || '[Name]'}` : `Hi ${name || '[Name]'}`;
  const opener = tone === 'warm' ? 'Hope you’re doing well. I wanted to reach out about' : tone === 'formal' ? 'I am writing regarding' : 'I’m reaching out about';
  const request = tone === 'formal' ? `Would you kindly ${ask || '[next step]'}?` : tone === 'warm' ? `Would you be open to ${ask || '[next step]'}?` : `Could you ${ask || '[next step]'}?`;
  return `${greeting},\n\n${opener} ${topic || '[topic]'}.${context ? ` ${context}` : ''}\n\n${request}\n\nBest,\n[Your name]`;
}

if (typeof document !== 'undefined') {
  const checker = document.querySelector('[data-tool="copy-check"]');
  checker?.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = analyzeDraft(checker.elements.draft.value);
    document.querySelector('#copy-results').innerHTML = `<div class="stats"><div class="stat"><strong>${result.words}</strong>words</div><div class="stat"><strong>${result.sentences}</strong>sentences</div><div class="stat"><strong>${result.longSentences.length}</strong>long sentences</div></div><ul class="checks">${result.longSentences.length ? `<li>Split or simplify ${result.longSentences.length} sentence(s) over 24 words.</li>` : '<li>No sentence over 24 words found by this simple check.</li>'}${result.foundFillers.length ? `<li>Review filler phrase(s): ${result.foundFillers.join(', ')}.</li>` : '<li>No common filler phrases found.</li>'}</ul>`;
  });

  const builder = document.querySelector('[data-tool="email-builder"]');
  builder?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(builder));
    document.querySelector('#email-result').textContent = buildEmail(data);
  });

  const leadForm = document.querySelector('[data-tool="leadhub-capture"]');
  const leadHubUrl = document.querySelector('meta[name="leadhub-base-url"]')?.content.trim();
  if (leadForm && leadHubUrl && /^https:\/\//i.test(leadHubUrl)) {
    leadForm.hidden = false;
    leadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = leadForm.querySelector('button[type="submit"]');
      const status = leadForm.querySelector('[data-lead-status]');
      button.disabled = true;
      status.textContent = 'Sending confirmation…';
      try {
        const response = await fetch(`${leadHubUrl.replace(/\/$/, '')}/api/subscribe`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: 'draftloom', email: leadForm.elements.email.value, consent: leadForm.elements.consent.checked, source: location.pathname }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Signup failed. Try again later.');
        status.textContent = payload.message || 'Check your inbox to confirm.';
        leadForm.reset();
      } catch (error) {
        status.textContent = error.message || 'Could not reach the signup service. Try again later.';
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const text = document.querySelector(button.dataset.copy)?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy the text';
    }
  });
}
