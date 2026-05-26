$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

# AgentBridge 0.1.6 npm package points at a dev daemon path by default.
$env:AGENTBRIDGE_DAEMON_ENTRY = "../plugins/agentbridge/server/daemon.js"

abg claude @args
