const driveKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space']);

// Steering and pedals keep working when a HUD button has keyboard focus.
// Preserve text entry, browser shortcuts and Space activation on buttons.
export function createKeyboardControls({keys, state, focus, cancelCruise, pause, range, recover, lock=()=>{}}) {
  function keydown(e) {
    const {loaded, paused, preview} = state();
    if (!loaded || preview || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target;
    if (target?.isContentEditable || target?.closest?.('input,textarea,select,[role="textbox"],[role="slider"]')) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) pause(!paused);
      return;
    }
    if (paused) return;
    if (e.code === 'KeyL' || e.code === 'KeyR' || e.code === 'KeyK') {
      e.preventDefault();
      if (!e.repeat) (e.code === 'KeyL' ? range : e.code === 'KeyK' ? lock : recover)();
      return;
    }
    if (!driveKeys.has(e.code)) return;
    if (e.code === 'Space' && target?.closest?.('button,a[href],[role="button"]')) return;
    e.preventDefault();
    if (['Space','KeyS','ArrowDown'].includes(e.code)) cancelCruise();
    keys.add(e.code);
    focus();
  }
  function keyup(e) { keys.delete(e.code); }
  return {keydown, keyup};
}
