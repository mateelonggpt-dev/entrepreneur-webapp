# Thai Translation SOP

## Purpose
This SOP explains how to update Thai wording in the app without breaking English mode.

## Scope
Only update the Thai translation layer used when users switch language from English to Thai.

## Steps
1. Find the current translation system in /frontend
   - locales/
   - messages/
   - i18n/
   - dictionaries/
   - translation context/provider
2. Identify the Thai translation file or Thai dictionary.
3. Update Thai wording only.
4. Use THAI_ACCOUNTING_GLOSSARY.md for accounting terms.
5. Do not change English text.
6. If some UI text is hardcoded and cannot switch language:
   - report the file
   - suggest moving the text into the translation layer
7. Create or update TRANSLATION_REVIEW_TODO.md for uncertain wording.

## Expected output
- Thai translation updated
- English unchanged
- Missing Thai keys added
- Any hardcoded user-facing text reported