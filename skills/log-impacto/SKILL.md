# log-impacto

Registra uma nova entrada de impacto no arquivo `impacto_trabalho.xlsx` do Lucca.

## Arquivo alvo

```
G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\z_personal_folders\lucca_lanzellotti\impacto_trabalho.xlsx
```

## Comportamento

1. Pergunte ao usuário os campos abaixo (aceite respostas em linguagem natural e interprete):
   - **data** — padrão hoje se não informado (formato `YYYY-MM-DD`)
   - **projeto** — ex: AI Fee Auditor, Inventory Pages Check, Business Week Report, eleven-brands-ai-docs, OrganiHaus Operations, Geral
   - **categoria** — uma de: `Desenvolvimento`, `Análise`, `Automação`, `Manutenção`, `Documentação`, `Gestão`
   - **atividade** — frase curta (o que foi feito)
   - **descricao** — detalhamento livre (pode ser vazio)
   - **impacto** — qual problema resolve ou valor gerado
   - **metrica** — ex: "Horas economizadas/semana", "Redução de erros manuais" (pode ser vazio)
   - **valor** — número da métrica, se aplicável (pode ser vazio)
   - **status** — `Em andamento` ou `Concluído` (padrão: `Concluído`)

2. Mostre um resumo da entrada antes de salvar e peça confirmação.

3. Após confirmação, use Python para appender a linha no xlsx:

```python
import openpyxl
from datetime import date

XLSX_PATH = r"G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\z_personal_folders\lucca_lanzellotti\impacto_trabalho.xlsx"

wb = openpyxl.load_workbook(XLSX_PATH)
ws = wb["Impacto"]

nova_linha = [
    "<data>",        # YYYY-MM-DD
    "<projeto>",
    "<categoria>",
    "<atividade>",
    "<descricao>",
    "<impacto>",
    "<metrica>",
    "<valor>",
    "<status>",
]

ws.append(nova_linha)
wb.save(XLSX_PATH)
print("✅ Entrada registrada.")
```

4. Confirme ao usuário que a entrada foi salva, mostrando qual linha foi adicionada.

## Regras

- Nunca sobrescreva linhas existentes — sempre `ws.append()`.
- Se o arquivo não existir, oriente o usuário a rodar `criar_base_impacto.py` primeiro.
- Se `openpyxl` não estiver instalado, rode `pip install openpyxl` antes.
- Datas sempre no formato `YYYY-MM-DD`.
- Valores numéricos em `valor` devem ser salvos como número, não string.
