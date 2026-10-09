# Contributing to ReviewGround 🛡️

Thank you for your interest in contributing to **ReviewGround**! ReviewGround is an open-source, universal AI Code Reviewer and DevSecOps verification GitHub Action.

---

## Getting Started

### Prerequisites
- **Node.js**: `24.x` or later
- **npm**: `10.x` or later
- **Git**

### Local Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/reviewground.git
   cd reviewground
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify your setup:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```

---

## Development Workflow

1. **Create a Dedicated Branch**:
   - Features: `feature/<feature-name>`
   - Bug Fixes: `fix/<issue-name>`
   *(Never commit directly to `main`)*

2. **Making Changes**:
   - Keep files small, modular, and single-responsibility (target under ~250 lines).
   - Use native `fetch` over heavy vendor SDKs to maintain lightweight bundle sizes.
   - Use Zod schemas for runtime input and AI output validation.

3. **Building the Production Bundle**:
   GitHub Actions requires the entrypoint to be bundled into `dist/index.js`:
   ```bash
   npm run build
   ```
   Always commit the generated `dist/` bundle alongside your source code.

4. **Submitting a Pull Request**:
   - Push your branch to your fork.
   - Open a PR targeting `main`.
   - Complete the checklist in the PR template.
   - All CI checks (`test.yml`) must pass green before merge.

---

## Code of Conduct & License
ReviewGround is licensed under the **AGPL-3.0 License**. By contributing, you agree that your contributions will be licensed under the same terms.
