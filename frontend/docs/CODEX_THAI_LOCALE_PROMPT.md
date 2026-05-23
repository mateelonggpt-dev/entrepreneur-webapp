# Codex Prompt for Thai Locale Update

Use this prompt in Codex:

My app already supports switching between English and Thai.

Important:
- Do NOT replace all English UI text in the codebase.
- Do NOT hardcode Thai into components unless required by the existing translation architecture.
- Do NOT change the English mode.
- Only update the Thai translation layer used when the app switches from English to Thai.

Task:
1. Search inside /frontend and find where the app stores translation strings, locale dictionaries, language maps, or i18n config.
2. Update only the Thai translations.
3. Keep English strings unchanged.
4. If a Thai translation key is missing, add it only in the Thai translation file or Thai dictionary.
5. Follow:
   - frontend/docs/THAI_ACCOUNTING_GLOSSARY.md
   - frontend/docs/THAI_TRANSLATION_RULES.md
   - frontend/docs/THAI_TRANSLATION_SOP.md
6. Do not change business logic.

Output:
- Show which files control Thai mode
- Show only Thai translation changes
- Report any hardcoded user-facing text that cannot switch language properly
- Create or update frontend/docs/TRANSLATION_REVIEW_TODO.md if needed