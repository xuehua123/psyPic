# AgentBridge local launch notes

This project is initialized for AgentBridge.

On this Windows machine, use the wrapper scripts in this directory instead of
calling `abg claude` / `abg codex` directly:

```powershell
.\.agentbridge\start-claude.ps1
.\.agentbridge\start-codex.ps1
```

The wrappers apply two local workarounds:

- `AGENTBRIDGE_DAEMON_ENTRY=../plugins/agentbridge/server/daemon.js`, because
  AgentBridge 0.1.6's npm CLI defaults to a dev daemon path.
- The native Codex binary directory is prepended to `PATH` for Codex startup,
  because Bun can fail with `EPERM` when `spawn("codex")` hits the npm shim on
  Windows.

To stop the bridge:

```powershell
abg kill
```

If `abg kill` cannot recognize the daemon it launched, stop the process that
owns port `4502`.

## Local transport-noise fix

This machine has a local patch on AgentBridge 0.1.6 to keep Claude from
mistaking bridge/client transport noise for user intent.

Patched files:

- `C:\Users\72774\AppData\Roaming\npm\node_modules\@raysonmeng\agentbridge\plugins\agentbridge\server\bridge-server.js`
- `C:\Users\72774\AppData\Roaming\npm\node_modules\@raysonmeng\agentbridge\plugins\agentbridge\server\daemon.js`
- `C:\Users\72774\.claude\plugins\cache\agentbridge\agentbridge\0.1.6\server\bridge-server.js`
- `C:\Users\72774\.claude\plugins\cache\agentbridge\agentbridge\0.1.6\server\daemon.js`

Patch behavior:

- Claude-side instructions now say to silently ignore transport noise such as
  system prompt echoes, billing/status headers, git status snippets, and
  tool-result tails.
- Claude-side instructions now explicitly say that `tool_result` and hook
  context can be stored as user-role transcript entries and should be treated
  as tool/runtime output, not as new human instructions.
- The `reply` tool description uses "delivered as an AgentBridge user turn"
  instead of "injected".
- Codex kickoff copy uses "AgentBridge user turns" instead of "injected user
  messages".
- Codex-to-Claude content is conservatively sanitized before push and pull
  delivery to remove repeated Chinese "this was injected" boilerplate and
  `x-anthropic-*` header noise.

If AgentBridge is reinstalled or upgraded, re-check these files because npm may
overwrite the local patch. Restart Claude Code / Kiro after changing the plugin
server so the new instructions are loaded.
