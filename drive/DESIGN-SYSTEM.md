# LC100 interface system

Judge Dean LLC owns the game's visual language. Controls should feel like one restrained expedition instrument panel, and leave the vehicle and terrain visible. Shared tokens and control styling live in `ui-system.css`; HUD positioning stays in the existing layout stylesheets.

## Icons and labels

- Never use emoji, Unicode pictograms, operating-system icons, icon fonts, or unstyled native disclosure markers in the game UI. Rendering must be consistent across browsers and devices.
- Prefer a clear text label. **Skip intro** is text only. Continue, Back, Boards, radio power, and route selection use language rather than a decorative arrow or checkmark.
- Use the authored `ui-icons.svg` sprite for compact controls that benefit from a symbol: close, station stepping, navigation, map expansion, and steering cues. Extend that same family when another symbol is necessary.
- Draw icons on a 24 by 24 viewBox, using a 1.75-unit rounded stroke, `currentColor`, and no fill. Normal visible size is 22 px; compact navigation cues can use 20 px.
- Decorative SVGs have `aria-hidden="true"`, `focusable="false"`, and no pointer events. The parent button owns its accessible name and entire click target. Icon-only buttons require a specific label such as “Close radio.”
- Disclosure chevrons are authored CSS strokes matching the SVG family. Form sliders use explicitly styled tracks and thumbs on WebKit and Firefox; they must not inherit platform styling.

## Color and action hierarchy

| Role | Token | Value |
| --- | --- | --- |
| Base surface | `--ui-surface` | `#172d32` |
| Raised surface | `--ui-surface-raised` | `#203c41` |
| Primary text | `--ui-text` | `#fff2dc` |
| Supporting text | `--ui-text-muted` | `#c4d3ce` |
| Primary action | `--ui-accent` | `#f2a45f` |
| Primary action text | `--ui-ink` | `#142b30` |
| Active drivetrain state | `--ui-selection` | `#f0c39a` |
| Selected choice outline | `--ui-border-strong` | `#c4e2dc` |
| Keyboard focus | `--ui-focus` | `#ffd2a4` |

Orange means commit or advance: Continue, Keep exploring, and Pitch shelter. A chosen route has a pale outline, a quieter teal fill, and the word **Selected**. It is visually distinct from the orange confirmation button. Other toggles communicate their state through text or `aria-pressed`, a brighter outline, and a teal fill. Active drivetrain modes use sand fill with dark text for fast reading against the landscape.

Secondary actions use a dark teal surface and a pale border. The same hierarchy applies to the intro, route selection, radio, weather, recovery, and camp. Do not invent a new color or corner shape for an isolated control.

## Geometry and interaction

- Spacing scale: 4, 8, 12, 16, and 24 px.
- Corner radii: 8 px controls, 12 px cards, 16 px panels. The circular minimap and driving joystick are purpose-built instruments and retain their geometry.
- Minimum control target: 44 by 44 px for icon buttons; text controls are at least 44 px tall. Keep their responsive layout and safe-area spacing intact.
- Focus: a visible 2 px sand outline with 3 px offset. The minimap places focus inside its circular boundary to avoid clipping.
- Keep the existing sans-serif and monospaced text roles. Icons never depend on fonts.
- Color transitions last 140 ms. Panel entrances last 240 ms and use only composited opacity/translation. Respect reduced motion, keep controls immediately usable, and do not animate text metrics, panel dimensions, or driving HUD positions on key presses.
- Preserve semantic `button`, `dialog`, `details`, and range controls. Custom appearance must not replace keyboard interaction or accessible names.

## Change checklist

Use the shared tokens and icon source; label the action plainly; verify hover, focus, pressed, disabled, and reduced-motion states. Check phone portrait, tablet landscape, and desktop for overlap, clipped targets, missing icons, and vehicle visibility before publishing. A decorative child must never intercept a button click.

## Trail markers

World checkpoints use the same orange, dark teal and cream palette as the interface. The next stop has an orange numbered fabric banner marked **Next**. Upcoming stops use weathered cream; passed stops use quiet teal with **Passed** and the authored check path while retaining their number. Numbers stay the same physical size when progress changes.

Use planted timber posts, dark metal hardware, stitched cloth and small named plaques. The large banner and name sit outside the left shoulder; a smaller opposite marker makes the passage clear. Signs read correctly from both sides, receive scene lighting and use subtle motion only on loose cloth. Reduced motion keeps the cloth still. Avoid floating number panels, glowing road lines, pulsing markers or default icon glyphs. Camp entrance signs stand outside the tent clearing and remain after arrival.

Prepare all route names and state labels in one atlas before driving. Reuse the four marker groups through checkpoint advances and origin shifts. Visual shoulder spacing is separate from the unchanged checkpoint acceptance radius; preserve the narrow bridge's clearance. Cache terrain-aware shoulder placement during startup so plaques stay above slopes without adding terrain probes to checkpoint transitions.
