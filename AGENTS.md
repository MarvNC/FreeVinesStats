# AGENTS.md — FreeVinesStats

Coding agent instructions for the FreeVinesStats repository.

---

## Project Overview

React 19 + TypeScript + Vite frontend dashboard that displays Amazon Vine item statistics.
Uses Tailwind CSS v4 for styling, Recharts for charts, Day.js for date handling, and Lodash for data processing.
**Package manager: Bun** (use `bun` for all installs and script runs — not npm/yarn).

---

## Build / Dev Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server at http://localhost:3000
bun run build        # TypeScript check + production build
bun run preview      # Preview the production build
```

### Running Tests

There is one test file: `scripts/benchmark-stats.test.ts`.
It uses **Bun's built-in test runner** (`bun:test`) — no separate Jest/Vitest setup needed.

```bash
# Run all tests
bun test

# Run a single test file
bun test scripts/benchmark-stats.test.ts

# Run a specific test by name pattern
bun test --test-name-pattern "matches baseline output"
```

### Type Checking

```bash
bun run build        # Runs `vite build` which includes tsc --noEmit
```

There is no standalone `tsc` script; type errors surface via `bun run build`.

---

## Repository Structure

```
/
├── components/          # Reusable React UI components
├── hooks/               # Custom React hooks
├── scripts/             # Benchmark / test scripts
├── services/            # API layer (fetch wrappers)
├── utils/               # Pure data-processing utilities
├── types.ts             # Shared TypeScript interfaces & type aliases
├── App.tsx              # Root application component
├── index.tsx            # React entry point
├── vite.config.ts       # Vite config (alias @/ → project root)
├── tailwind.config.js   # Tailwind v4 config
└── tsconfig.json        # TypeScript config
```

---

## Code Style Guidelines

### TypeScript

- **Target:** ES2022 with `moduleResolution: "bundler"` and `isolatedModules: true`.
- Always provide explicit types for function parameters and return values in utility functions.
- Use `interface` for object shapes (props, data models) and `type` for unions/aliases.
- Use `import type` for type-only imports (e.g., `import type { HistoryItem } from '../types'`).
- All shared types live in `types.ts` at the project root — do not scatter type definitions.
- `React.FC<Props>` is the standard component type annotation.

### Imports

- **Path alias:** `@/` resolves to the project root. Prefer it for cross-directory imports.
  ```ts
  import { processStats } from '@/utils/analytics';   // preferred
  import { processStats } from '../utils/analytics';  // also acceptable within scripts/
  ```
- Import order (no enforcer, follow this manually):
  1. React and React-ecosystem packages
  2. Third-party libraries (dayjs, lodash, recharts, react-icons)
  3. Internal modules via `@/` alias (services, utils, hooks, components)
  4. Type-only imports (`import type ...`)
- dayjs plugins are extended at module top level, not inside components.
- Named exports from `types.ts`; default exports for components and hooks.

### Components

- One component per file; filename matches the exported component name (PascalCase).
- Components live in `components/`; custom hooks live in `hooks/`.
- Props interfaces are defined directly above the component in the same file.
- Do not use `export default` inline with the definition — declare the component then export.
- Prefer destructured props in the function signature.

### Hooks

- Hooks are default exports from `hooks/` (e.g., `export default function useDarkMode()`).
- Use `as const` tuple returns when a hook returns multiple values (not an object).

### State & Performance

- Use `useMemo` for all expensive derived data (data processing, chart transformation).
- Wrap async data fetching in `useEffect` with cleanup (`clearInterval`, event listeners, etc.).
- Prefer `useState` + `useMemo` over external state management libraries.
- Add `console.time` / `console.timeEnd` with a `[Perf]` prefix for any operation that processes large datasets.

### Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Components | PascalCase | `StatCard`, `PulseChart` |
| Hooks | camelCase with `use` prefix | `useDarkMode` |
| Utility functions | camelCase | `processStats`, `processChartData` |
| TypeScript interfaces | PascalCase | `HistoryItem`, `DashboardStats` |
| Type aliases | PascalCase | `Timeframe`, `Granularity` |
| Constants | UPPER_SNAKE_CASE | `TIMEZONE`, `INTERVAL_MS` |
| CSS classes | Tailwind utility classes only | |

### Error Handling

- In `useEffect` async functions, always wrap in `try/catch/finally`.
- Set error state as a human-readable string; display it in the UI rather than throwing.
- Always call `console.timeEnd` in the catch block if `console.time` was called before the await.
- API errors should produce a user-facing message (e.g., `'Failed to load stats. Please check your connection.'`).
- Never silently swallow errors — at minimum log them.

### Styling

- **Tailwind CSS v4** with a `class`-based dark mode strategy (`dark:` prefix).
- Custom design tokens are defined in `tailwind.config.js`:
  - Colors: `primary`, `primary-dark`, `background-light`, `background-dark`, `heat-0..5`
  - Font: `font-sans` → Inter
  - Shadow: `shadow-soft`
- Use `dark:` variants for every color that differs between themes.
- Material Symbols icons are loaded via CDN as `<span class="material-symbols-outlined">`.
- `react-icons` is used for brand icons (e.g., `FaGithub`).
- Avoid arbitrary Tailwind values; prefer the configured theme tokens.

### Data Layer

- All API calls live in `services/api.ts` and return typed Promises.
- All data transformation logic lives in `utils/analytics.ts` as pure functions.
- Components must not contain data transformation logic — extract to `utils/`.
- The canonical AI item count accessor: `item.ai ?? item.encore ?? 0` (handles legacy field name).

---

## Testing Guidelines

- Tests use `bun:test` (`describe`, `it`, `expect`).
- Test files are named `*.test.ts` and live in `scripts/`.
- Benchmark tests compare an optimized implementation against a known-good legacy baseline using `_.isEqual`.
- Use `performance.now()` (from `node:perf_hooks`) for timing, not `Date.now()`.
- Tests may specify a custom timeout as the third argument to `it(name, fn, timeoutMs)`.

---

## Commit Messages

Use **commitlint** conventions. Commit messages must follow the format:

```
<type>: <short imperative summary>
```

Common types: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`.

Examples matching this repo's history:
```
feat: add hourly heatmap component
fix: correct left padding on pulse chart
refactor: extract chart data processing to utils
docs: update AGENTS.md
```

Run `bunx commitlint --edit` locally to validate a message before pushing.

---

## Configuration Notes

- `vite.config.ts`: dev server runs on port 3000, bound to `0.0.0.0`.
- `tsconfig.json`: `allowJs: true`, `noEmit: true`, `jsx: react-jsx` (no React import needed in TSX).
- No ESLint or Prettier configs are present — maintain consistency with existing code style manually.
- `bun.lock` is committed; always use Bun to install packages.
