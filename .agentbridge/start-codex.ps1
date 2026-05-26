$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

# AgentBridge 0.1.6 npm package points at a dev daemon path by default.
$env:AGENTBRIDGE_DAEMON_ENTRY = "../plugins/agentbridge/server/daemon.js"

# On Windows, Bun's spawn("codex") can hit the npm shim first and fail with EPERM.
# Put the native Codex binary directory first so AgentBridge starts codex.exe.
$CodexNativeDir = Join-Path $env:APPDATA "npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\codex"
if (Test-Path $CodexNativeDir) {
  $env:PATH = "$CodexNativeDir;$env:PATH"
}

abg codex @args
