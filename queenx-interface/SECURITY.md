# Security Policy

## Supported Versions
Security updates are actively provided for the following releases:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability
The Queen project takes security vulnerabilities seriously.

1. **Do not create public GitHub issues** for suspected security vulnerabilities.
2. Email details and reproduction steps to the project maintainers.
3. You will receive an acknowledgment within 48 hours.
4. Maintainers will coordinate a responsible disclosure and patch release.

## Security Architecture & Best Practices
- **No Hardcoded Credentials**: All router actions authenticate via standard LuCI RPC session tokens.
- **Strict Input Validation**: All backend ucode endpoints sanitize parameters before committing to UCI or executing subsystem commands.
- **Rollback Protection**: In-flight UCI transactions maintain atomic rollback snapshots (`/tmp/*.bak`) to prevent device lockouts on invalid configurations.
- **Client Isolation**: Guest wireless networks enforce hardware BSSID client isolation (`isolate '1'`).
