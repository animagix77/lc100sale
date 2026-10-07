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
      question: 'Is she for sale? What’s the price?',
      reply: '$TBD. The owner is considering a sale but hasn’t decided to let her go. The latest mechanic recommends EVAP replacement: solenoid, canister and gas cap. Work is pending. Built an entire website. Still emotionally attached. Classic.',
      link: 'See the sale status and comparables', href: '#price'
    },
    {
      question: 'How much work does it need?',
      reply: 'EVAP replacement is planned: solenoid, canister and gas cap, per the latest mechanic visit. The sunroof, driver’s seat heater and other listed items still need attention. The repair list has direction. The wallet has concerns.',
      link: 'Read the known issues', href: '#condition'
    },
    {
      question: 'What are the EVAP codes?',
      reply: 'P2418, P0442 and P0446 remain unresolved. Following the October 7 mechanic visit, EVAP replacement is planned: solenoid, canister and gas cap. Work is pending and emissions readiness is unconfirmed. EPA, contain your excitement. The owner is about to pay good money to contain the vapors.',
      link: 'Read the latest EVAP update', href: '#evap-update'
    },
    {
      question: 'Where are the running boards?',
      reply: 'He removed them to make the truck look taller. His wife has submitted the appeal. Use the grab handle; the additional height was strictly a visual upgrade.',
      link: 'Read the cabin notes', href: '#cabin-condition'
    },
    {
      question: 'Does she drive well? Any records?',
      reply: 'The owner says she drives great, without shaking or rattling. Brake work, a new AGM starter battery and other maintenance are listed in the service history. Dates and work are recalled from memory; service receipts are unavailable.',
      link: 'Read the owner-recalled service history', href: '#history'
    },
    {
      question: 'What equipment comes with her?',
      reply: 'Malone crossbars are included; rooftop tents, awnings and camping gear are excluded. She has OME suspension, KM3 tires, 1.25-inch Bora spacers installed in 2025, two functional rear jump seats and a 2-inch hitch receiver. The penthouse was a previous tenancy.',
      link: 'See the camping equipment note', href: '#camping'
    },
    {
      question: 'Where is she? Can I see her?',
      reply: 'Leonia, New Jersey. The owner is still deciding whether to sell. Email animagix@mac.com to express interest and discuss next steps. The truck has a location. The owner’s resolve is harder to pin down.',
      link: 'Express interest', href: '#contact'
    },
    {
      question: 'If he sells, how would pickup work?',
      reply: 'If the owner decides to sell and you agree on a price: wire, cash or a directly verified cashier’s/certified check; no personal checks. Payment must be verified and received before handoff. The owner keeps the NJ plates. Arrange your own insurance and legal registration/permit, or towing. Optimism is not a payment method.',
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
    reply: 'That one needs the owner. I’ve got the published notes and a mouth, not a diagnostic scanner. Email the owner for an answer.',
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
    if (!modalOpen) queuePlacement();
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
  const journeyControls = document.querySelector('.journey-controls');
  let queued = false;
  function place() {
    queued = false;
    if (widget.hidden) return;
    const bounds = controls.getBoundingClientRect();
    const visible = bounds.bottom > 0 && bounds.top < innerHeight && content.getBoundingClientRect().top > bounds.top;
    widget.classList.toggle('rusty-on-tour', visible);
    const launcherBounds = launcher.getBoundingClientRect();
    const style = getComputedStyle(widget);
    const priorClearance = parseFloat(style.getPropertyValue('--rusty-clearance')) || 0;
    // Test the resting position, so raising Rusty cannot oscillate on the next frame.
    const restingBottom = parseFloat(style.bottom) - priorClearance;
    const restingTop = innerHeight - restingBottom - launcherBounds.height;
    const journeyBounds = journeyControls?.getBoundingClientRect();
    const overlaps = journeyBounds && journeyBounds.bottom > 0 && journeyBounds.top < innerHeight &&
      journeyBounds.left < launcherBounds.right && journeyBounds.right > launcherBounds.left &&
      journeyBounds.bottom > restingTop && journeyBounds.top < innerHeight - restingBottom;
    const clearance = overlaps ? Math.max(0, Math.ceil(innerHeight - journeyBounds.top + 12 - restingBottom)) : 0;
    widget.style.setProperty('--rusty-clearance', clearance + 'px');
  }
  function queuePlacement() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  window.addEventListener('scroll', queuePlacement, {passive: true});
  window.addEventListener('resize', queuePlacement);
  syncVisibility();
  place();
})();
