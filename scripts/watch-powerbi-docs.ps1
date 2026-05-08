# watch-powerbi-docs.ps1
# Monitora TODOS os arquivos .tmdl dos SemanticModels (medidas E tabelas) e
# atualiza a documentacao automaticamente quando qualquer um mudar.
# Roda em foreground — deixe esta janela aberta enquanto trabalha no Power BI Desktop.
#
# Uso:
#   .\scripts\watch-powerbi-docs.ps1
#
# Para parar: Ctrl+C

$UPDATE_SCRIPT = Join-Path $PSScriptRoot "update-powerbi-docs.ps1"
$DEBOUNCE_SECONDS = 5

$WATCH_FOLDERS = @{
    "base-tables"  = "G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Base Tables\OrganiHaus - Base Tables.SemanticModel\definition\tables"
    "operations"   = "G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Operations\OrganiHaus - Operations.SemanticModel\definition\tables"
    "profitability" = "G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\Organihaus - Profitability\OrganiHaus - Profitability.SemanticModel\definition\tables"
}

Write-Host "=== Power BI Docs Watcher ===" -ForegroundColor Cyan
Write-Host "Monitorando .tmdl (medidas + tabelas) em:"
foreach ($entry in $WATCH_FOLDERS.GetEnumerator()) {
    $exists = Test-Path $entry.Value
    $status = if ($exists) { "" } else { " [NAO ENCONTRADO]" }
    Write-Host ("  [{0}] {1}{2}" -f $entry.Key, $entry.Value, $status) -ForegroundColor $(if ($exists) { "DarkGray" } else { "Yellow" })
}
Write-Host "`nAguardando mudancas... (Ctrl+C para parar)`n" -ForegroundColor DarkGray

$watchers = [System.Collections.Generic.List[System.IO.FileSystemWatcher]]::new()
$pending  = [System.Collections.Hashtable]::Synchronized(@{})

foreach ($entry in $WATCH_FOLDERS.GetEnumerator()) {
    $dashboard = $entry.Key
    $path      = $entry.Value

    if (-not (Test-Path $path)) { continue }

    $watcher = New-Object System.IO.FileSystemWatcher
    $watcher.Path             = $path
    $watcher.Filter           = "*.tmdl"
    $watcher.NotifyFilter     = [System.IO.NotifyFilters]::LastWrite
    $watcher.EnableRaisingEvents = $true

    # Pass $pending via MessageData so the action can write to it across runspaces
    $action = [ScriptBlock]::Create(@"
        param(`$source, `$e)
        `$event.MessageData['$dashboard'] = [datetime]::Now
        Write-Host ("  [{0}] {1} modificado" -f '$dashboard', `$e.Name) -ForegroundColor Yellow
"@)

    Register-ObjectEvent -InputObject $watcher -EventName Changed -Action $action -MessageData $pending | Out-Null
    Register-ObjectEvent -InputObject $watcher -EventName Created -Action $action -MessageData $pending | Out-Null
    $watchers.Add($watcher)
}

try {
    while ($true) {
        Start-Sleep -Seconds 1
        $now = [datetime]::Now

        $toRun = @()
        foreach ($key in @($pending.Keys)) {
            if (($now - $pending[$key]).TotalSeconds -ge $DEBOUNCE_SECONDS) {
                $toRun += $key
                $pending.Remove($key)
            }
        }

        foreach ($dash in $toRun) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Atualizando $dash..." -ForegroundColor Cyan
            & $UPDATE_SCRIPT -Dashboard $dash
        }
    }
}
finally {
    foreach ($w in $watchers) { $w.Dispose() }
    Get-EventSubscriber | Unregister-Event -ErrorAction SilentlyContinue
    Write-Host "`nWatcher encerrado." -ForegroundColor DarkGray
}
