// Rusty answers only from the published owner notes. No generated advice or tracking.
(() => {
  const widget = document.getElementById('rusty-widget');
  const launcher = document.getElementById('rusty-launcher');
  const panel = document.getElementById('rusty-panel');
  const menu = document.getElementById('rusty-menu');
  const answer = document.getElementById('rusty-answer');
  const topics = document.getElementById('rusty-topics');
  const question = document.getElementById('rusty-question');
  const reply = document.getElementById('rusty-reply');
  const destination = document.getElementById('rusty-destination');
  const guideAction = document.getElementById('rusty-guide-action');
  const body = document.getElementById('rusty-body');
  const notes = [
    {
      question: 'What’s the asking price?',
      reply: '$11,000 asking for the 2004 Land Cruiser, sold as is. Roughly 220,000 miles is the owner’s estimate. The repair list comes at no extra charge.',
      link: 'Talk to the owner', href: '#contact'
    },
    {
      question: 'How much work does it need?',
      reply: 'Known rust, unresolved EVAP faults and other disclosed repairs make this a project truck. Inspect it yourself or bring an independent mechanic. The to-do list has already applied for overtime.',
      link: 'Read the known issues', href: '#condition'
    },
    {
      question: 'What are the EVAP codes?',
      reply: 'P2418, P0442 and P0446 remain unresolved. The owner’s mechanic suspects the area in the photos and recommended a body shop/welder assessment. The cause, repair scope and cost remain unconfirmed. My crystal ball is also out for repairs.',
      link: 'See the mechanic’s notes and photos', href: '#mechanic-photos'
    },
    {
      question: 'Where are the running boards?',
      reply: 'The owner removed them to make her look more lifted. That was the entire engineering brief. The grab handle helps with boarding; his wife has supplied extensive verbal feedback.',
      link: 'Read the cabin notes', href: '#cabin-condition'
    },
    {
      question: 'Does she drive well? Any records?',
      reply: 'The owner reports oil changes every 5,000 miles, two Denso coils replaced in 2019, 3M undercoating and periodic underbody rinses. She drives great, with no shaking or rattling, per the owner. Service receipts aren’t available. Enthusiasm has yet to qualify as a service record.',
      link: 'Read the owner-recalled service history', href: '#history'
    },
    {
      question: 'What equipment comes with her?',
      reply: 'Malone crossbars are included. She has OME suspension, KM3 tires, Bora spacers, two functional rear jump seats and a 2-inch hitch receiver. Rooftop tents, awnings and camping gear in historical photos aren’t included. The penthouse was a previous tenancy.',
      link: 'See the camping equipment note', href: '#camping'
    },
    {
      question: 'Where is she? Can I see her?',
      reply: 'Leonia, New Jersey. Private sale, with viewings by arrangement. Call 917-981-5816 or email animagix@mac.com to set a time. Bring questions and a flashlight. She’s ready for her extremely unglamorous close-up.',
      link: 'Arrange a viewing', href: '#contact'
    },
    {
      question: 'Payment and getting her home?',
      reply: 'Wire, cash or a directly verified cashier’s/certified check; no personal checks. Payment must be verified and received before handoff. The owner keeps the NJ plates. Arrange your own insurance and legal registration/permit, or towing. Optimism is not a payment method.',
      link: 'See payment and pickup details', guide: true
    }
  ];
  let previousTopic = null;
  function showAnswer(note, button) {
    previousTopic = button;
    question.textContent = note.question;
    reply.textContent = note.reply;
    destination.hidden = !!note.guide;
    guideAction.hidden = !note.guide;
    if (!note.guide) { destination.href = note.href; destination.textContent = note.link; }
    menu.hidden = true;
    answer.hidden = false;
    body.scrollTop = 0;
    question.focus({preventScroll: true});
  }
  for (const note of notes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = note.question;
    button.addEventListener('click', () => showAnswer(note, button));
    topics.append(button);
  }
  const other = document.createElement('button');
  other.type = 'button';
  other.className = 'rusty-other';
  other.textContent = 'My question isn’t here';
  other.addEventListener('click', () => showAnswer({
    question: 'Got another question?',
    reply: 'That one needs the owner. I’ve got the published notes and a mouth, not a diagnostic scanner. Call or email for an answer.',
    link: 'Contact the owner', href: '#contact'
  }, other));
  topics.append(other);
  function close(returnFocus = true) {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    if (returnFocus && !widget.hidden) launcher.focus({preventScroll: true});
  }
  launcher.addEventListener('click', () => {
    if (!panel.hidden) { close(); return; }
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    document.getElementById('rusty-close').focus({preventScroll: true});
  });
  document.getElementById('rusty-close').addEventListener('click', () => close());
  document.getElementById('rusty-back').addEventListener('click', () => {
    menu.hidden = false;
    answer.hidden = true;
    body.scrollTop = 0;
    previousTopic?.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); }
  });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !widget.contains(event.target)) close(false);
  });
  widget.querySelectorAll('a').forEach(link => link.addEventListener('click', () => close(false)));
  function syncVisibility() {
    const modalOpen = !!document.querySelector('dialog[open]');
    if (modalOpen) close(false);
    widget.hidden = modalOpen;
  }
  const observer = new MutationObserver(syncVisibility);
  document.querySelectorAll('dialog').forEach(dialog => observer.observe(dialog, {attributes: true, attributeFilter: ['open']}));
  guideAction.addEventListener('click', () => {
    close(false);
    const guide = document.getElementById('purchase-guide');
    guide.addEventListener('close', () => { syncVisibility(); launcher.focus({preventScroll: true}); }, {once: true});
    document.querySelector('.purchase-trigger').click();
  });
  const controls = document.querySelector('.orbit-bottom');
  const content = document.querySelector('.page-content');
  let queued = false;
  function place() {
    queued = false;
    const bounds = controls.getBoundingClientRect();
    const visible = bounds.bottom > 0 && bounds.top < innerHeight && content.getBoundingClientRect().top > bounds.top;
    widget.classList.toggle('rusty-on-tour', visible);
  }
  function queuePlacement() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  window.addEventListener('scroll', queuePlacement, {passive: true});
  window.addEventListener('resize', queuePlacement);
  syncVisibility();
  place();
})();
