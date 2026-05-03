# Security

Do not open public GitHub issues for undisclosed credential leaks or active exploitation.

For sensitive reports, use [GitHub private vulnerability reporting](https://github.com/yoraibe-tr/regul8-mcp/security/advisories/new) if enabled for this repository, or contact the maintainers through a private channel.

This MCP server runs locally and forwards requests to Regul8/Base44 using credentials you supply; treat `.env` and MCP `env` blocks like any other secret material.
