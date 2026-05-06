# Contributing to ReliefConnect

Thank you for your interest in contributing to ReliefConnect.

## Before you start

- Check existing issues and pull requests before starting work.
- Open an issue for major features, architectural changes, or large refactors before implementing them.
- Keep pull requests focused. Smaller, reviewable changes are easier to merge safely.

## Development setup

### Prerequisites

- Node.js 22 or later
- pnpm 10 or later
- .NET SDK 10.0
- PostgreSQL with PostGIS enabled

### Install dependencies

```bash
./run-all.ps1 -Install
```

Or install manually:

```bash
cd client
pnpm install

cd ../src
dotnet restore
```

## Running the project locally

### Start both apps

```bash
./run-all.ps1
```

### Frontend

```bash
cd client
pnpm dev
```

### Backend

```bash
cd src/ReliefConnect.API
dotnet run
```

## Testing before submitting

Run the checks that match your changes:

### Frontend

```bash
cd client
pnpm build
pnpm lint
```

### Backend

```bash
cd src/ReliefConnect.Tests
dotnet test
```

### End-to-end

```bash
npx playwright test
```

## Branches and commits

- Create a feature branch from `temp`.
- Dependabot and other automated dependency pull requests should also target `temp`.
- Use clear branch names such as `feature/map-filter`, `fix/login-cookie`, or `docs/contributing-guide`.
- Use clear commit messages. Conventional-style prefixes such as `feat`, `fix`, `docs`, `refactor`, and `test` are encouraged.

## Pull request checklist

Before opening a pull request, make sure you:
- Describe the purpose of the change.
- Link the related issue when possible.
- Include screenshots or recordings for UI changes.
- Confirm the relevant tests or checks were run.
- For grouped dependency updates, run the checks relevant to the affected stack; review major upgrades more carefully than routine patch or minor updates.
- Avoid committing secrets, tokens, or environment-specific credentials.

## Security contributions

If you discover a vulnerability, do not open a public issue. Please follow [SECURITY.md](SECURITY.md).

## Code of conduct

By participating in this project, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
