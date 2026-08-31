# OrganiHaus — Families Index

> Migrado do Notion (`_Products — Index`, última atualização lá: 2025-04, versão 1.2). Índice de todas as famílias de produto OrganiHaus. Ler esta página antes de buscar detalhes de SKU — cada família tem seu próprio arquivo em `families/`. Ver [identifiers.md](identifiers.md) para o modelo completo de identificadores (ASIN, Base SKU, SKU por país, FNSKU), apelidos de família, códigos históricos descontinuados e o tratamento de Rainbow como Native Family separada.

## Linha: Rope Baskets

Amazon Store: https://www.amazon.com/stores/page/C7C94D12-356A-4C3A-8B78-EB1E43D08D39

| Família | Nome | Status | Arquivo |
|---|---|---|---|
| OHSB-3HH | Shelf Basket (Set of 3, Hidden Handles) — "3HH" também usado como apelido da família OHSB inteira | ✅ Active | [families/ohsb-3hh.md](families/ohsb-3hh.md) |
| OHSB-1HH | Shelf Basket (Single, Hidden Handles) | ✅ Active | [families/ohsb-1hh.md](families/ohsb-1hh.md) |
| OHSB-RH-SET4 | Shelf Basket (Set of 4, Rope Handles) | ✅ Active | [families/ohsb-rh-set4.md](families/ohsb-rh-set4.md) |
| OHRB | Round Baskets | ✅ Active | [families/ohrb.md](families/ohrb.md) |
| OHRB-L | Leather Handles | ⚠️ Deprecating | [families/ohrb-l.md](families/ohrb-l.md) |
| OHNB-DC | Diaper Caddy | ✅ Active | [families/ohnb-dc.md](families/ohnb-dc.md) |
| OHHB-3OD | Over the Door | ✅ Active | [families/ohhb-3od.md](families/ohhb-3od.md) |
| OHAB | Animal Basket (Unicorn) | ⚪ Discontinued | [families/ohab.md](families/ohab.md) |
| OHRT | Rope Tray | ⚪ Discontinued | [families/ohrt.md](families/ohrt.md) |
| OHPB | Plant Basket | ⚪ Discontinued | [families/ohpb.md](families/ohpb.md) |
| OHHP | Hanging Planter | ⚪ Discontinued | [families/ohhp.md](families/ohhp.md) |
| OHMH | Magazine Holder | ⚪ Discontinued | [families/ohmh.md](families/ohmh.md) |
| OHWB | Wall Basket | ⚪ Discontinued | [families/ohwb.md](families/ohwb.md) |

## Linha: Fabric Baskets

Amazon Store: https://www.amazon.com/stores/page/F01E961C-A0B6-4E70-B7A7-B490703E5766

| Família | Nome | Status | Arquivo |
|---|---|---|---|
| OHFB-\*VH | Fabric Baskets Vegan Handles | ✅ Active | [families/ohfb-vh.md](families/ohfb-vh.md) |
| OHFB-\*RH | Fabric Baskets Rope Handles | ✅ Active | [families/ohfb-rh.md](families/ohfb-rh.md) |
| OHSC-4VH | Storage Cubes | ✅ Active | [families/ohsc-4vh.md](families/ohsc-4vh.md) |
| OHSO | Shoe Organizer | ✅ Partial | [families/ohso.md](families/ohso.md) |
| OHUB | Under Bed Storage | ✅ Partial | [families/ohub.md](families/ohub.md) |

## Outros produtos

| Família | Nome | Status | Arquivo |
|---|---|---|---|
| OHTW | Tableware | ⚠️ Considering deprecation | [families/ohtw.md](families/ohtw.md) |

## Convenção de SKUs

- Estrutura geral: `{BRAND}{PRODUCT}-{VARIANT}-{DIM}-{COLOR}`
- Status: ✅ Active | ⚠️ Deprecating | ⚪ Discontinued | 🔜 Planned
- Famílias deprecated podem ter unidades residuais em alguns mercados
- Rainbow é tratado separadamente por profitabilidade, keywords e estratégia — não agrupar com cores sólidas

## AI usage notes

- Sempre consultar o arquivo da família antes de responder sobre SKUs específicos
- Não assumir que uma família existe em todos os mercados
- Em caso de conflito entre documentos, prevalece o de data mais recente
- Terminologia de status padronizada em 2026-08-27: usar sempre **Discontinued**, nunca "Deprecated", para produtos que pararam de ser vendidos. A planilha `Product Information and Pricing Database.xlsx` usa os dois termos de forma inconsistente — tratar como sinônimos, preferir "Discontinued" em qualquer documentação nova.
- **`LS6-*` (Light Stick) não é produto OrganiHaus** — é um produto da marca IncrediGlow vendido temporariamente através desta conta Amazon. Não incluir em análises de catálogo OrganiHaus. Não documentado aqui — se necessário, ver `references/incrediglow/` (ainda não existe).
- **`CAMISA-LOGISTICS`** (ex: `Y8-68D4-N83G`) não é produto — é placeholder de frete/logística dentro da mesma planilha de produtos. Ignorar em qualquer leitura de catálogo.
- A coluna `Status` da planilha de origem não é confiável para famílias antigas/pouco movimentadas (ver notas de conflito em `OHRT`, `OHPB`, `OHHP`, `OHMH`, `OHWB`) — confirmar com Antonio Bindi antes de assumir Active/Discontinued para famílias fora do catálogo ativo principal.
