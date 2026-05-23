# Thai Translation Rules

## Goal
The app already supports English and Thai mode.
Do NOT replace all English text in the app.
Only improve the Thai translation layer used when the language is switched to Thai.

## Rules
- Keep English strings unchanged.
- Update only the Thai locale or Thai translation dictionary.
- Do not hardcode Thai text directly into components unless the project already does that for all languages.
- If a Thai translation key is missing, add it only in the Thai translation file.
- Follow THAI_ACCOUNTING_GLOSSARY.md exactly for accounting terms.
- Preserve all placeholders such as:
  - {name}
  - {{name}}
  - ${value}
  - %s
  - :id
- Preserve JSX, HTML, and line breaks.
- Keep button labels short and natural.
- Keep accounting document names formal and correct.

## If uncertain
- Prefer natural Thai first.
- Add the uncertain wording to TRANSLATION_REVIEW_TODO.md for human review.

## Never change
- variable names
- function names
- import paths
- API response keys
- database fields
- routes
- backend logic