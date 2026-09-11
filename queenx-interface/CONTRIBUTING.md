# Contributing to Queen

Thank you for your interest in contributing to **Queen**!

## Code of Conduct
Please be respectful and constructive in all issues, pull requests, and community discussions.

## Development Workflow
1. **Fork the repository** on GitHub.
2. **Create a topic branch** (`git checkout -b feature/my-new-feature`).
3. **Follow code guidelines**:
   - **Frontend**: Clean Vanilla JavaScript (ES6+), LuCI `view.extend` pattern, responsive styling without external frameworks.
   - **Backend**: ucode (`/usr/libexec/rpcd/*`) with safe UCI cursor transactions and exception handling.
   - **Sanitization**: Never commit passwords, IP hardcoding, or private keys.
4. **Test on Real Hardware**:
   - Test on OpenWrt 24.x / 25.x devices.
   - Verify non-destructive polling and input field stability.
5. **Submit a Pull Request** with a detailed explanation of changes and test results.
