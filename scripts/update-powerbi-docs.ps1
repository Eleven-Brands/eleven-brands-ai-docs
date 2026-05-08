# update-powerbi-docs.ps1
# Atualiza a documentacao de medidas DAX nos arquivos de referencia Power BI.
# Roda o parser Python diretamente — zero tokens Claude.
#
# Uso:
#   .\scripts\update-powerbi-docs.ps1
#   .\scripts\update-powerbi-docs.ps1 -Dashboard operations

param(
    [ValidateSet("all", "base-tables", "operations", "profitability")]
    [string]$Dashboard = "all"
)

$ROOT    = Split-Path -Parent $PSScriptRoot
$SCRIPT  = Join-Path $PSScriptRoot "update-powerbi-docs.py"

Write-Host "Atualizando referencias Power BI..." -ForegroundColor Cyan

python $SCRIPT --dashboard $Dashboard

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDONE! --> references/power-bi/ atualizado" -ForegroundColor Green
} else {
    Write-Host "`nERRO ao executar o parser Python." -ForegroundColor Red
    exit 1
}
