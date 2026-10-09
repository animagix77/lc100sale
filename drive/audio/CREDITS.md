# Coastal audio sources

All field recordings below are released under CC0. Downloaded October 6, 2026. Encoded locally to AAC; no remote audio requests at runtime.

- **Former V8 idle/load (retained source assets, no longer played):** “v8 engine rev.wav” by overmedium, https://freesound.org/people/overmedium/sounds/651534/ . Source vehicle is unknown (author says so); this is not a verified Toyota recording. Short steady excerpts trimmed, overlap-looped and circular RMS-leveled to remove the original rev envelope, then filtered and repitched at runtime.
- **Ocean bed:** “Sea Waves with Tern Calls” by DenisChardonnet, BigSoundBank 0267, https://bigsoundbank.com/sea-waves-and-seagulls-s0267.html . The birds in this recording are terns, separate from the added gull calls. End crossfaded, soft limited and normalized.
- **Water tyre accents:** “Beach Ocean Waves” by jasinski, shared by qubodup, https://opengameart.org/content/beach-ocean-waves . Clips 01 and 02, normalized and repitched for splash accents.
- **Gulls:** “Solo Seagull Sound Effects” by Rango Mango, https://opengameart.org/content/solo-seagull-sound-effects . Ambient clips 1 and 3 only; normalized and softly varied in pitch/pan.
- **Sand:** “Footsteps in Sand” by kessir, https://freesound.org/people/kessir/sounds/264124/ . Short overlapping grains make continuous tyre grit rather than repeated footstep cadence; normalized and loop crossfaded.

CC0: https://creativecommons.org/publicdomain/zero/1.0/

## Vehicle reference material (not sampled)
- “2UZ-FE Engine Idle & Rev Sound (Land Cruiser 100 Series)”: https://www.youtube.com/watch?v=LQ4d4oJrmXo . Reference identified; no recording copied or embedded.
- Toyota Land Cruiser Amazon launch press pack, describing the 4.7 V8 and quiet operation: https://media.toyota.co.uk/wp-content/uploads/sites/5/pdf/LC-Amazon-UK-launch-pack-1997.pdf . Target is a smooth, muted SUV engine, not an open-exhaust muscle car.

## Music
“No Particular Hurry” is an original 108 BPM D minor instrumental, expanded from the site's 75-second preview into a 96-bar, 217.33-second arrangement. No borrowed melody or music samples. Editable composition: `../source/compose-soundtrack.py`.


## LC FM station music
The current jazz, hip-hop, EDM, ’80s rock, ’90s rock, country and K-pop stations use the seven four-minute MP3s supplied by the owner on October 8, 2026 in the project’s `audio` folder. They are copied unchanged to `radio/*.mp3`, including their embedded provenance metadata. `../source/radio-library.json` records the source filenames, checksums and measured levels. Station display names are LC FM preset names; the source files contain no song-title or artist tags.

Playback applies a small per-station attenuation toward −13 LUFS without recompressing or limiting the recordings. Only the selected station loads after radio power-on. The original “No Particular Hurry” remains on Sunset.

The earlier synthesized instrumental tracks are retained as `radio/*.m4a`, with their historical composition source in `../source/compose-radio.py` and metadata in `../source/radio-tracks.json`. Those seven older arrangements are no longer selected by the radio. Their original composition credits apply only to those retained files, not the replacement MP3s.

## Smooth engine drone
The current engine sound is an original synthesized harmonic drone, replacing the recorded idle/load loops entirely to remove their puttering exhaust texture. Four phase-aligned sine partials follow RPM with smoothed frequency and gain, filtered for a muted petrol-V8 character. No random detuning or rhythmic amplitude modulation. This is a stylized game sound, not an authenticated Toyota recording. Ocean, sand, gulls and water accents remain from the credited recordings above.
