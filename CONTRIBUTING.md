# Contributing to @montageai/sdk

Thanks for considering a contribution! The SDK is the API client used to call
the Montage rendering service from JS/TS applications, framework adapters
(Mastra, LangChain, Vercel AI SDK), and the React `<HtmlBlock>` component.

## Development setup

```bash
git clone https://github.com/usemontage/sdk
cd sdk
pnpm install
```

The package source lives in `src`.

## Running the test suite

```bash
pnpm test
```

Tests are written in [Vitest](https://vitest.dev/). The suite covers:

- `tools.ts` — fetch wiring, error envelope handling, framework definitions
- `agent-adapter.ts` — adapter contract, capability validation, JSON-schema
  enforcement
- `capability-bridge.ts` — adapter capability routing for generated artifacts
- `html/mount-html-block.ts` — bundled HTML mount + inline script execution
- `react/HtmlBlock.tsx` — React wrapper for the HTML mount

## Type checking

```bash
pnpm typecheck
```

## Building

```bash
pnpm build
```

Outputs `.js` + `.d.ts` to `dist`.

## Pull request guidelines

- Include unit tests for any behavior change. New error paths in particular
  should be covered.
- Run `pnpm typecheck && pnpm test`
  before opening a PR.
- Keep public surface changes minimal — the SDK is intentionally narrow. New
  exports should solve a real host integration problem.
- Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes
  (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

## Reporting issues

File issues at https://github.com/usemontage/sdk/issues. Include a
minimal reproduction, your Node and SDK versions, and the relevant API
response if applicable.
