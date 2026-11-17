// Judge Dean LLC — camp talk for the wait before the expedition.
// This tiny script runs while the game bundle and scenery are still downloading.
if (new URLSearchParams(location.search).get('preview') !== '1') {
  const lines = [
    'Bought mud tires for the suburbs. That Costco speed bump knows my name.',
    '“You’ve got room on my side.” Great. I’m driving on this side.',
    'According to the bag, this tent used to be smaller.',
    'We packed light. The cast-iron waffle maker is the travel one.',
    '“It’s ankle-deep.” The guy who said that was standing on the roof.',
    'My traction boards are bright orange so I can see where I buried $300.',
    'A sleeping bag rated to 20 degrees. At 21 I started taking it personally.',
    '“I know a shortcut.” Nobody put the shovel away.',
    'Found the one rock under the tent. With my hip. At 3 a.m.',
    'I spent two hours leveling the truck. My egg still ran to the left.',
    'Camp coffee has two grind settings. Fine, and still in your teeth.',
    '“The tide was out when we parked.” Excellent work, everyone.',
    'That new pinstripe? The trail signed the truck.',
    'The raccoon got the good cheese. We’re down to emergency cheddar.',
    '“We can make camp before dark.” Hand me the damn headlamp.',
    'Four-wheel drive got us here. The shovel would like some credit for getting us out.'
  ];

  class LoadingQuip extends HTMLElement {
    remaining = [];
    timer = null;

    connectedCallback() {
      if (this.timer !== null) return;
      this.showNext();
      this.timer = setInterval(() => {
        if (!document.hidden) this.showNext();
      }, 6500);
    }

    disconnectedCallback() {
      // Moving the same line from the loading screen into the briefing
      // preserves its reading time, including on a slow connection.
      queueMicrotask(() => {
        if (this.isConnected) return;
        clearInterval(this.timer);
        this.timer = null;
      });
    }

    showNext() {
      if (!this.remaining.length) {
        this.remaining = [...lines];
        for (let i = this.remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
        }
        const last = this.remaining.length - 1;
        if (this.remaining[last] === this.textContent) {
          [this.remaining[0], this.remaining[last]] = [this.remaining[last], this.remaining[0]];
        }
      }
      this.textContent = this.remaining.pop();
      if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
        this.animate([{opacity: .6}, {opacity: 1}], {duration: 220});
      }
    }
  }

  customElements.define('lc-loading-quip', LoadingQuip);
}
