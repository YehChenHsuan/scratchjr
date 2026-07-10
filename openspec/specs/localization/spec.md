# Localization Specification

## Requirements

- With no saved localization setting, the app loads `zh-tw` regardless of browser locale.
- A language selected in Settings is persisted and takes precedence on future launches.
- Exact locale matching uses array membership, not JavaScript's `in` operator on `Object.keys()`.
- Missing media translation keys fall back to the media's supplied display name.
- Traditional Chinese must render with system CJK fonts without a network font request.

## Acceptance

- Fresh storage starts in Traditional Chinese.
- Switching to English and restarting remains English.
- Clearing only the localization cookie returns to Traditional Chinese.
- No `String missing:` text appears for built-in characters or backgrounds.

