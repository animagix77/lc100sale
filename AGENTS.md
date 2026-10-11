# Shared app development preferences

- Use Judge Dean LLC for new developer branding, app-facing copy, metadata, documentation, and authored file headers. Do not introduce the owner's personal name into new app-facing material or identifiers.
- Use `com.judgedeanllc` for new bundle/package identifiers and purchase IDs. Preserve released identifiers, signing identities, entitlements, purchase IDs, and persistence keys unless a migration is explicitly approved.
- These are forward-looking defaults, not permission to bulk-rename existing apps or alter identity, legal, tax, banking, or authentication records.

# Interface design

- Follow `drive/DESIGN-SYSTEM.md` for the LC100 interface. Extend its shared tokens and components instead of inventing isolated styles.
- Never use default system/OS icons, emoji, icon fonts, or Unicode pictograms as UI icons. Use the authored `drive/ui-icons.svg` family, matching CSS shapes, or equivalent canvas paths.
- Prefer clear text labels. Keep **Skip intro** text-only; do not add an arrow or other decorative icon to it.
- The sale site and game share icon geometry. Preserve accessible names and keyboard behavior; decorative SVG children must not intercept pointer input.
