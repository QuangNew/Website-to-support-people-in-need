# GitHub bots setup

This guide explains how ReliefConnect uses GitHub's built-in automation for dependency hygiene and security scanning.

## Recommended bots

- **Dependabot** for dependency update pull requests and security update pull requests
- **CodeQL** for code scanning and security analysis

These two cover the most useful baseline automation for this repository.

## Rules adopted from mature GitHub repositories

ReliefConnect follows a few lightweight rules commonly seen in popular repositories:
- Keep contribution and security rules explicit and easy to find.
- Use private workflows for vulnerabilities instead of public issue threads.
- Make bot pull requests follow the same branch strategy as normal contributor work.
- Group routine dependency updates to reduce PR noise.
- Review major version upgrades more carefully than routine patch or minor updates.

## 1. Dependabot

### Repository branch rule

Dependabot pull requests should target `temp`, matching the current contributor workflow.

### GitHub repository settings to check

In GitHub, open:
- **Settings → Security & analysis**

Enable these features if available:
- Dependency graph
- Dependabot alerts
- Dependabot security updates

### Ecosystems covered in this repository

ReliefConnect includes:
- **npm** dependencies at `/`
- **npm** dependencies at `/client`
- **NuGet** dependencies in:
  - `/src/ReliefConnect.API`
  - `/src/ReliefConnect.Core`
  - `/src/ReliefConnect.Infrastructure`
  - `/src/ReliefConnect.Tests`
- **GitHub Actions** workflows at `/.github/workflows`

### Configuration approach

The live config in `.github/dependabot.yml` should:
- target `temp`
- run on a weekly schedule
- group routine version updates by ecosystem
- keep PR volume low with `open-pull-requests-limit`
- label dependency PRs by area such as `dependencies`, `frontend`, `backend`, and `ci`
- use a `chore(deps)`-style commit prefix

### Triage rule

After Dependabot opens a pull request:
- patch and minor updates usually get the normal relevant checks and review
- major updates should receive broader manual review
- security update pull requests should be prioritized over routine version bumps

### Ignore rules and tracking

This repository's `.gitignore` already allows `.github/dependabot.yml`, so the config can be committed normally.

## 2. CodeQL

### What it does

CodeQL scans the repository for common security issues and surfaces results in GitHub's code scanning UI.

### GitHub repository settings to check

In GitHub, open:
- **Security → Code scanning**

Choose one of these setup paths:
- **Default setup** for the fastest GitHub-managed onboarding
- **Advanced setup** if you want a committed workflow file and more control

### Suggested follow-up

After enabling CodeQL:
- review alerts in **Security → Code scanning**
- mark false positives carefully and document why
- treat new high-severity alerts as release blockers when they affect authentication, uploads, authorization, or user data

## 3. Recommended rollout order

1. Enable **Dependency graph**, **Dependabot alerts**, and **Dependabot security updates** in repository settings
2. Add and commit `.github/dependabot.yml`
3. Enable **CodeQL default setup** first for immediate coverage, or commit a workflow later if you want workflow-based control
4. Review the first week of alerts and tune labels, schedules, or grouping if needed
