# Repository Guidelines

## Project scope

This repository publishes the NestJS 11 library `@nest-mods/throttler-plus`.
Keep changes focused on the library, its tests, documentation, packaging, and
release automation.

The main implementation areas are:

- `src/index.ts`: the public package entry point and export boundary;
- `src/throttler-plus.module.ts`: module registration and storage ownership;
- `src/throttler-plus.guard.ts`: HTTP and lazy GraphQL request handling;
- `src/use-throttler.decorator.ts`: the decorator-based public API;
- `test/e2e/`: installed-package HTTP and GraphQL verification.

## Toolchain and dependencies

- Use Node.js 24 or newer and Deno 2.9.3, matching the GitHub workflows.
- `package.json` is the dependency manifest and `deno.lock` is the only root
  dependency lock file. Do not add npm, pnpm, or Yarn lock files.
- Restore dependencies with `deno install --frozen`. Do not use `npm install`
  for routine root-project setup.
- Keep npm and Deno on their default registries when resolving dependencies.
  Never commit mirror registry URLs to `deno.lock` or repository config.
- Preserve the dual ESM/CommonJS build and the existing Node.js 24 engine
  requirement.

## Implementation constraints

- Keep public exports explicit in `src/index.ts`. Any public API change must
  update the README and relevant tests.
- Keep GraphQL support lazy. Normal HTTP consumers must not need
  `@nestjs/graphql` or `graphql` installed.
- Preserve optional peer dependency behavior and avoid importing optional
  packages from eager module paths.
- Redis-backed storage owned by the module must be closed with the Nest
  application. Custom storage remains the caller's responsibility.
- Reject ambiguous storage configuration. Do not silently prefer Redis over a
  user-provided throttler storage, or vice versa.
- Prefer targeted changes over broad refactors, and do not modify unrelated code
  while completing a task.

## Verification

Start with the smallest check that covers the change, then widen only when the
affected boundary requires it.

```bash
deno fmt --check
deno lint
deno task typecheck
deno task build
deno task test --runInBand
deno task test:e2e
```

- Unit tests are colocated with the source as `src/**/*.spec.ts`. Add or update
  them for behavior changes.
- The e2e suites require Docker and validate the packed package through real
  HTTP and GraphQL applications. Run the relevant suite when request handling,
  optional peers, Redis integration, or installed-package behavior changes.
- Pull requests and pushes to `main` run the complete unit and e2e workflow.
- Tag publishing deliberately calls the reusable CI workflow with
  `skip_e2e: true`; it repeats the unit job but not the expensive e2e job. Do
  not add e2e back to the publishing path unless explicitly requested.

## Package contents

- Published packages contain compiled output in `dist/` and production
  TypeScript sources in `src/`.
- Source specs, `test/`, coverage data, workflow files, and local tarballs must
  not be published. Keep `package.json#files` and `.npmignore` aligned.
- When packaging rules change, inspect the actual file list with:

```bash
npm pack --dry-run --json
```

The file list must include both `dist/` and non-test `src/` files and must not
contain `*.spec.ts`, `*.test.ts`, or `test/` paths.

## CI and releases

- `.github/workflows/ci.yml` is both the normal PR/main workflow and the
  reusable verification workflow. Its `skip_e2e` input defaults to `false`.
- `.github/workflows/publish.yml` runs only for pushed `v*` tags. The tag name
  without the leading `v` must equal the version in `package.json`.
- Publishing uses the organization-level `NPM_TOKEN`, the public npm registry,
  public package access, and npm provenance. Never print, replace, or commit
  secret values.
- After npm publishing succeeds, the workflow creates a GitHub Release for the
  same tag with generated release notes.
- Keep Node.js and Deno versions aligned between CI and publishing workflows.
- Do not create or push a version tag, publish to npm, or create a release
  unless the user explicitly requests that external action.

## Documentation and repository hygiene

- Keep `README.md` synchronized with public behavior, installation requirements,
  and package usage.
- Do not commit generated `dist/`, coverage output, package tarballs, or e2e
  fixture tarballs.
- Preserve user changes already present in the worktree and avoid unrelated
  formatting or cleanup.
