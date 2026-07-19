# Contributing to lyt

Thanks for helping make lyt easier and safer to use.

## Before opening an issue

1. Run `lyt doctor` and copy the non-sensitive diagnostic output.
2. Check existing issues for the same symptom.
3. Remove private URLs, cookies, tokens, usernames, and local secrets.
4. Confirm the media is yours or you have permission to download it.

## Development setup

lyt requires Node.js 20 or newer and has no runtime npm dependencies.

```sh
npm test
npm run check:pack
npm run check
```

Keep human-readable output compatible unless a change is intentionally
breaking. Machine output must continue to follow `lyt.result.v1` unless a new
versioned schema is introduced.

## Pull requests

- Keep one clear purpose per pull request.
- Add or update tests for behavior changes.
- Update the README and changelog for user-visible changes.
- Run `npm run check` before requesting review.
- Do not include downloaded media, cookies, tokens, or personal data.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
