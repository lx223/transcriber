# Interface design

Guided by Anthropic's [frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design), reviewed on 26 October 2026. The skill was read from a temporary checkout; no third-party skill code ships with the app.

## Direction

A quiet transcription workspace, with the recording and resulting document as the main objects. Keep the task above the fold rather than presenting a marketing landing page.

- Canvas: #f5f7f9; paper: #ffffff; ink: #24303c; secondary ink: #566475; action blue: #315ed3; border: #e0e5eb.
- Typography: the operating system's native sans-serif for clear, fast-loading controls. One family, three main levels: 36 px page heading, 16 px panel heading, 14 px controls/body. Tabular numerals for timestamps only.
- Layout: left-aligned heading above one workspace. Narrow source/settings column, wider transcript column. Stack columns on small screens. Align panel titles and content padding.
- Interaction: a functional drag-and-drop/file picker, visible focus, a single primary action, and optional advanced processing controls. No decorative animation; respect reduced motion.

```text
transcriber                                  Processed on your device

Turn audio into text.
English and Chinese transcription, in your browser.

+----------------------+-------------------------------------+
| Recording            | Transcript                     Ready|
| [ Choose a file ]    |                                     |
| Language / model     |       Choose a recording to begin   |
| Advanced options     |                                     |
| [ Transcribe ]       |                                     |
+----------------------+-------------------------------------+
```

## Review against the brief

The earlier oversized hero, numbered circles, all-caps labels and decorative waveform consumed space without helping the task. Remove them. Use blue only for actions, focus and active state; avoid tinted headline fragments, generic feature cards and gradients. The transcript is a readable document with clickable timestamp rows, not another settings card.

Keep privacy and first-use download behavior visible without repeating either throughout the page. Errors explain the next step. Files and recognized text are inserted with textContent, never interpreted as markup.

## Video playback

A selected recording opens immediately in an HTML video player above the transcript. Keep preview playback available during inference. Timestamp rows seek and start the same media element; playback highlights the active passage without forcing the reader to scroll. Selecting a different source clears the previous transcript and releases its object URL. Audio-only input keeps compact controls.
