param(
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][string]$Token,
    [Parameter(Mandatory=$false)][string]$Method = "tools/call",
    [Parameter(Mandatory=$false)][string]$ToolName = "",
    [Parameter(Mandatory=$false)][string]$ArgumentsFile = "",
    [Parameter(Mandatory=$false)][string]$Id = "1"
)
# Tavo MCP Server direct HTTP JSON-RPC helper (ASCII only, works with Windows PowerShell 5.1)
# Usage:
#   powershell -File tavo_rpc.ps1 -Url "http://host:7347/mcp" -Token "xxx" -ToolName tavo_status
#   powershell -File tavo_rpc.ps1 -Url "http://host:7347/mcp" -Token "xxx" -ToolName tavo_character_create -ArgumentsFile args_char.json
$h = @{ Authorization = ('Bearer ' + $Token); 'Content-Type' = 'application/json'; Accept = 'application/json, text/event-stream' }

if ($ToolName) {
    $toolJson = $ToolName | ConvertTo-Json -Compress
    if ($ArgumentsFile -and (Test-Path $ArgumentsFile)) {
        $argsJson = Get-Content $ArgumentsFile -Raw -Encoding UTF8
        $body = '{"jsonrpc":"2.0","id":' + $Id + ',"method":"tools/call","params":{"name":' + $toolJson + ',"arguments":' + $argsJson + '}}'
    } else {
        $body = '{"jsonrpc":"2.0","id":' + $Id + ',"method":"tools/call","params":{"name":' + $toolJson + ',"arguments":{}}}'
    }
} else {
    $body = '{"jsonrpc":"2.0","id":' + $Id + ',"method":"' + $Method + '","params":{}}'
}

try {
    $r = Invoke-WebRequest -Uri $Url -Method Post -Headers $h -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -UseBasicParsing -TimeoutSec 120
    Write-Output $r.Content
} catch {
    Write-Output ('ERROR: ' + $_.Exception.Message)
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Output $sr.ReadToEnd()
    }
}
