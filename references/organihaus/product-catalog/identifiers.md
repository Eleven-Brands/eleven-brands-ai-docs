# OrganiHaus — Modelo de Identificadores de Produto

> Criado em 2026-08-27 por Antonio Bindi & Claude. Não existia em nenhuma fonte anterior (Notion nem os docs de Power BI) — reconstruído a partir de `Product Information and Pricing Database.xlsx` (Google Drive, `01 - OH Sourcing and Orders`), BigQuery (`amazon-sp-api-openbridge`), Jarvio, e confirmação direta do Antonio. Este é o dicionário de dados que os outros documentos (Power BI, product-catalog) pressupõem mas nunca definiram.

## Os quatro identificadores

| Nível | O que é | Onde vive | Exemplo |
|---|---|---|---|
| **ASIN** | ID da Amazon para o produto/parent | Amazon, `Hierarchy` (planilha) | `B0BW11TGH2` |
| **Base SKU** | Identificador interno do produto, **sem** país — usado nas tabelas de BI (`SKUs[Base SKU]`) para análise agregada por produto | `Hierarchy`, `SKUs by Region` (planilha) | `OHFB-3VH-1208M-BGOW` |
| **SKU** | SKU físico real, **com prefixo de país** — o que de fato é enviado pra Amazon por mercado | `SKUs by Region` (planilha) | `US-OHFB-3VH-1208M-BGOW`, `EU-...`, `CA-...` |
| **FNSKU** | ID que a Amazon atribui ao SKU físico (etiqueta de armazém) | `SKUs by Region` (planilha), BigQuery `0_product_model.td_skus` | por SKU |

**Por que o prefixo de país existe:** controle de COGS e nível de estoque por mercado, e rastreabilidade de onde cada unidade física está sendo vendida/devolvida. O Base SKU permite analisar o produto "de forma abstrata", independente de onde foi vendido.

## Hierarquia de família (4 níveis)

Confirmado na aba `Hierarchy` da planilha — mais granular do que os docs de Power BI sugerem (que só usam `Native Family` e `Amazon Family` sem explicar a escada completa):

```
Generic Family   (ex: OHFB)          — a linha/produto mais ampla
  └─ Standard Family  (ex: OHFB-VH)      — tipo de handle/material
       └─ Core Family   (ex: OHFB-1VH)     — + quantidade no pack
            └─ Native Family (ex: OHFB-1VH-M) — + o que afeta fulfillment/COGS (size, pack)
```

- **Native Family** é o nível que importa pra decisões de fulfillment e custo — duas variações do mesmo Standard Family com tamanhos ou packs diferentes são Native Families diferentes, mesmo compartilhando o mesmo "nome" comercial.
- **Amazon Family** (campo separado, na aba `SKUs by Region`, ex: `OHFB-RH-CUBE`, `OHRB-2013-1518`) é o agrupamento de "toda a variation family sob um parent ASIN" — não é um 5º nível da escada acima, é um agrupamento paralelo do ponto de vista da Amazon (listing), não de fulfillment/COGS.

## Apelidos de família

Antonio se refere a famílias inteiras usando o nome de uma variante específica quando essa variante é a mais relevante ou histórica. Confirmado: **"3HH" é usado como apelido pra família `OHSB` inteira**, mesmo a família tendo 3 variantes reais (`OHSB-1HH`, `OHSB-3HH`, `OHSB-RH-SET4` — ver `families/ohsb-3hh.md`).

**Regra geral para IA:** ao ouvir um código de família em conversa, não assumir que é literal — confirmar se a referência é à variante específica ou à família toda antes de agir. Esse padrão provavelmente se repete em outras famílias com múltiplas variantes; ainda não mapeado exaustivamente.

## Códigos históricos — sub-famílias descontinuadas

Relatórios antigos (principalmente **PPC**) podem referenciar sub-famílias que não existem mais como parents separados:

| Código antigo | Significado | Status |
|---|---|---|
| `OHRB-FULL` | Round Baskets, colorway sólida ("full color") | Consolidado em `OHRB` |
| `OHRB-3T` | Round Baskets, "3-toned" | Consolidado em `OHRB` |
| `OHRB-S` | Round Baskets, "stripes" | Consolidado em `OHRB` |

Essas viveram por um tempo como **parents ASIN separados**, como estratégia de visibilidade (mais listings = mais superfície de busca). Foram depois consolidadas de volta em `OHRB` como família única. **Não são erro de dado nem família ativa — são histórico legítimo.** Ao ver esses códigos num relatório de PPC antigo, tratar como sinônimos históricos de `OHRB`, não como entidades vivas.

> Padrão a observar: esse tipo de split-depois-consolidação pode ter acontecido em outras famílias além de `OHRB`. Ainda não mapeado — perguntar ao Antonio antes de assumir que um código desconhecido é erro.

## Rainbow como Native Family separada

`OHSB-3HH` (a variante, dentro da família OHSB), `OHRB` e `OHNB-DC` têm um colorway "Rainbow" tratado como **Native Family separada**, não como só mais uma opção de cor. Dois motivos de negócio:

1. **COGS diferenciado** — Rainbow custa diferente de produzir que as cores sólidas.
2. **Estratégia de keywords totalmente diferente** — confirmado em detalhe na página Notion `OHRB — KW & Search Term Strategy`: os childs Rainbow têm título, bullets e Generic Keywords **completamente separados** dos childs de cor sólida (ex: positionamento "nursery/playroom/classroom" em vez de "living room"; GK Rainbow dedicado, diferente do GK Master).

**Implicação prática para IA:** nunca agrupar SKUs Rainbow com cores sólidas em análise de performance, PPC, ou qualquer agregação por família — os dois precisam ser olhados separadamente, mesmo compartilhando o mesmo Generic/Standard/Core Family.

Também existem variações dentro do próprio guarda-chuva Rainbow (ex: em `OHSB-1HH`: `Rainbow`, `Rainbow Pastel`, e 7 tons de `Rainbow Bright` — Blue/Green/Orange/Off-White/Purple/Red/Yellow). Tratar como família de cores à parte, não assumir que "Rainbow" é uma cor única.

## Formato grade-and-resell (`amzn.gr.`)

Confirmado via Jarvio (`GET_MERCHANT_LISTINGS_ALL_DATA`). SKUs do programa Grade & Resell da Amazon seguem o padrão:

```
amzn.gr.{SKU físico com país}-{id aleatório de lote}-{sufixo de 2 letras}
```

Exemplo: `amzn.gr.US-OHFB-3VH-1208M-BGOW-w0RHjT-VG`

- O SKU físico (com prefixo de país) aparece logo após `amzn.gr.`
- O sufixo de 2 letras no final (`LN`, `VG`, etc.) é a grade de condição (ex: Like New, Very Good)
- **Associar sempre ao SKU físico embutido**, não tratar como um SKU novo/desconhecido

## SKUs a ignorar

- **`Z*`** — bundles virtuais criados pela própria Amazon. Não representam produto físico distinto — ignorar em qualquer análise de catálogo.
- **`CAMISA-LOGISTICS`** (ex: `Y8-68D4-N83G`) — placeholder de frete/logística dentro da planilha de produtos, não é produto.
- **`LS6-*`** (Light Stick) — produto da marca **IncrediGlow**, vendido temporariamente nesta conta Amazon. Não é OrganiHaus — não incluir em análises de catálogo OrganiHaus.

## Terminologia de status

Usar sempre **Discontinued**. A planilha de origem usa "Discontinued" e "Deprecated" como se fossem estados diferentes — na prática, tratar como sinônimos e padronizar em "Discontinued" em qualquer documentação nova (decisão de Antonio Bindi, 27/08/2026).

## Confiabilidade da coluna `Status` da planilha

A coluna `Status` da aba `Hierarchy` **não é confiável para famílias antigas ou pouco movimentadas** — várias famílias descontinuadas na prática (`OHRT`, `OHPB`, `OHHP`, `OHMH`, `OHWB`) ainda aparecem como `Active` na planilha. Não assumir Active/Discontinued a partir só desse campo para famílias fora do catálogo ativo principal — confirmar com Antonio Bindi.

## Fontes cruzadas

- `Product Information and Pricing Database.xlsx` (Google Drive) — abas `Hierarchy`, `SKUs by Region`, `Dimensions` — fonte primária deste documento
- BigQuery `amazon-sp-api-openbridge.0_product_model.td_skus` — Base SKU / SKU / FNSKU, mais enxuto que a planilha
- Jarvio (`GET_MERCHANT_LISTINGS_ALL_DATA` etc.) — validação de SKUs físicos ao vivo
- Notion `OHRB — KW & Search Term Strategy` — rationale de keyword por trás da separação Rainbow
