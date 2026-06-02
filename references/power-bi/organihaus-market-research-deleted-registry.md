# OrganiHaus – Market Research: Registro de Deleções

Arquivo de referência para itens deletados do modelo Market Research durante o redesign v2. Mantém a definição original para eventual recriação.

---

## Como usar

Cada entrada registra:
- **O que foi deletado** (tabela, medida, expressao, pagina ou parametro)
- **Data** da deleção
- **Motivo**
- **Dependências** (o que referenciava o item)
- **Definição original** para recriação

---

## 2026-05-29 — Remoção do Market Share

Market Share foi removido desta versão. A fonte de dados (`fact_COMP_sales`) era alimentada manualmente pelo time de Marketing via DataDive exports, a responsavel saiu e os dados estavam desatualizados. Decisao documentada no HANDOVER.md.

---

### Tabela: `fact_COMP_sales`

**Tipo:** Tabela Import (M query)
**Motivo:** Fonte manual desatualizada. Responsavel pela coleta saiu. Market Share fora do escopo desta versao.
**Dependências diretas removidas junto:** `z.dynamic_mkt_metrics_qtde`, `z.dynamic_Top_N_Competitors`, 29 medidas `displayFolder: MKTSHARE`, pagina "Market Share" do Report, expressoes `COMP_sales` e `aux_comp_sales` no `expressions.tmdl`
**Relacionamentos removidos:**
- `fact_COMP_sales.Brand` → `dim_featured_brands.Brand` (AutoDetected_b72f5fed)
- `fact_COMP_sales.Date` → `dim_calendar.Date` (c72231c8)
- `fact_COMP_sales.Marketplace` → `dim_country.Marketplace` (b8477939)
- `fact_COMP_sales.Highlight` → `dim_important_competitors.Id` (27c86213)

**Definição TMDL original (`tables/fact_COMP_sales.tmdl`):**
```tmdl
table fact_COMP_sales
    lineageTag: 84d6653e-8e43-4f71-a8c6-b9a61c2525d6

    column Brand
        dataType: string
        lineageTag: 9a252470-c4e5-4f0b-a5b8-95e14533a894
        summarizeBy: none
        sourceColumn: Brand

    column Month
        dataType: string
        lineageTag: 85ca9446-9911-4a94-b548-507971aff5d1
        summarizeBy: none
        sourceColumn: Month

    column Year
        dataType: string
        lineageTag: c1058aa8-cff2-4ca0-9537-f5610de96912
        summarizeBy: none
        sourceColumn: Year

    column Sales
        dataType: double
        lineageTag: 485a3f98-9de4-4c10-8df7-37622490870e
        summarizeBy: sum
        sourceColumn: Sales

    column Date
        dataType: dateTime
        formatString: Short Date
        lineageTag: 1af2ed58-d561-4b27-8b89-e5afdc364fa9
        summarizeBy: none
        sourceColumn: Date
        annotation UnderlyingDateTimeDataType = Date

    column Marketplace
        dataType: string
        lineageTag: 119bf3a8-accc-4f45-b445-b10677751568
        summarizeBy: none
        sourceColumn: Marketplace

    column 'Amazon Family'
        dataType: string
        lineageTag: ccb37d63-6d50-41a9-8757-00e46fd11727
        summarizeBy: none
        sourceColumn: Amazon Family

    column year_month
        dataType: string
        lineageTag: 48b9b48d-3545-4368-8f1d-c364ebd6107a
        summarizeBy: none
        sourceColumn: year_month

    column Highlight = ```
            IF(
                fact_COMP_sales[Brand] IN VALUES(dim_featured_brands[Brand]), 
                1, 
                0
            )
            ```
        formatString: 0
        lineageTag: 589c5730-1e82-457e-bf02-47fc28649e25
        summarizeBy: none

    partition fact_COMP_sales = m
        mode: import
        queryGroup: Marketshare
        source = ```
                let
                    COMP_Adjusted = Table.TransformColumnTypes(COMP_sales,
                        {{"Year", type text}, {"Month", type text}}),
                    aux_Adjusted = Table.TransformColumnTypes(aux_comp_sales,
                        {{"Month", type text}, {"Year", type text}}),
                    AppendedTables = Table.Combine({COMP_Adjusted, aux_Adjusted}),
                    Grouped = Table.Group(AppendedTables,
                        {"Marketplace", "Amazon Family", "Brand", "year_month"},
                        {
                            {"MaxSales", each List.Max([Sales]), type number},
                            {"Month", each List.First([Month]), type text},
                            {"Year", each List.First([Year]), type text},
                            {"DateList", each [date], type list}
                        }),
                    AddDate = Table.AddColumn(Grouped, "Date", each List.Max([DateList]), type date),
                    RemoveAux = Table.RemoveColumns(AddDate, {"DateList"}),
                    FinalFato = Table.RenameColumns(RemoveAux, {{"MaxSales", "Sales"}}),
                    FinalOrdered = Table.SelectColumns(FinalFato,
                        {"Marketplace", "Amazon Family", "Brand", "Month", "Year", "Sales", "year_month", "Date"}),
                    FilteredBagnizerCubes = Table.SelectRows(FinalOrdered,
                        each not ([Marketplace] = "US" and [Brand] = "Bagnizer" and [Amazon Family] = "OHFB-RH-CUBE")),
                    #"Removed Duplicates" = Table.Distinct(FilteredBagnizerCubes),
                    #"Filtered Rows" = Table.SelectRows(#"Removed Duplicates",
                        each [Sales] <> null and [Sales] <> "")
                in
                    #"Filtered Rows"
                ```
```

---

### Tabela: `z.dynamic_mkt_metrics_qtde`

**Tipo:** Tabela calculada (Field Parameter)
**Motivo:** Parametro de seleção de metrica para a pagina Market Share — deletada junto com a feature.
**Dependências:** Pagina Market Share (slicer `z.dynamic_mkt_metrics[Metric]`) e medidas `Growth_Rate_Market`, `Growth_Rate_OH`, `Total_Sales_OH`, `Total_Market_Sales (S/OH)`.

**Definição TMDL original (`tables/z.dynamic_mkt_metrics_qtde.tmdl`):**
```tmdl
table 'z.dynamic_mkt_metrics_qtde'
    lineageTag: 1b131501-f061-4452-b524-8464304f3d01

    column 'z.dynamic_mkt_metrics'
        lineageTag: bc037e22-0aa3-44f3-9714-933ef1dd4224
        summarizeBy: none
        sourceColumn: [Value1]
        sortByColumn: 'z.dynamic_mkt_metrics Order'

        relatedColumnDetails
            groupByColumn: 'z.dynamic_mkt_metrics Fields'

    column 'z.dynamic_mkt_metrics Fields'
        isHidden
        lineageTag: 7a578f86-7501-4778-b5a5-14f59120260f
        summarizeBy: none
        sourceColumn: [Value2]
        sortByColumn: 'z.dynamic_mkt_metrics Order'
        extendedProperty ParameterMetadata = {"version": 3, "kind": 2}

    column 'z.dynamic_mkt_metrics Order'
        isHidden
        formatString: 0
        lineageTag: 2ceba38d-a39c-470d-a62c-d301ec025bf9
        summarizeBy: sum
        sourceColumn: [Value3]

    column Metric = IF('z.dynamic_mkt_metrics_qtde'[z.dynamic_mkt_metrics Order] = 0, "Growth Rate", "Sales")
        lineageTag: c3076b7a-67ed-4662-9602-48a77cd02892
        summarizeBy: none

    partition 'z.dynamic_mkt_metrics_qtde' = calculated
        mode: import
        source =
                {
                    ("Market Growth Rate", NAMEOF('_Medidas'[Growth_Rate_Market]), 0),
                    ("OH Growth Rate", NAMEOF('_Medidas'[Growth_Rate_OH]), 0),
                    ("OH Total Sales", NAMEOF('_Medidas'[Total_Sales_OH]), 1),
                    ("Market Total Sales", NAMEOF('_Medidas'[Total_Sales (S/OH)]), 1)
                }

    annotation PBI_Id = 5c03785d613e451c85cc116ac1fe2dc9
```

---

### Tabela: `z.dynamic_Top_N_Competitors`

**Tipo:** Tabela calculada (Field Parameter — Numeric Range)
**Motivo:** Slicer de Top N para a pagina Market Share — deletada junto com a feature.
**Dependências:** Medidas `Others_Sales` e `Top_N_Comp` (ambas removidas no mesmo batch).

**Definição TMDL original (`tables/z.dynamic_Top_N_Competitors.tmdl`):**
```tmdl
table 'z.dynamic_Top_N_Competitors'
    lineageTag: 3949dde5-f9f3-4de5-8b08-19d55b074511

    measure 'z.dynamic_Top_N_Competitors Value' = SELECTEDVALUE('z.dynamic_Top_N_Competitors'[z.dynamic_Top_N_Competitors],10)
        formatString: 0
        lineageTag: 89833b65-3083-41b6-8cea-840a537bf457

    column 'z.dynamic_Top_N_Competitors'
        formatString: 0
        lineageTag: df0062bf-30a6-4e98-8783-fc9076de601a
        summarizeBy: none
        sourceColumn: [Value]
        extendedProperty ParameterMetadata = {"version": 0}

    partition 'z.dynamic_Top_N_Competitors' = calculated
        mode: import
        source = GENERATESERIES(1, 20, 1)

    annotation PBI_Id = bf8ff6ed636947f1a549a1b0e19ea555
```

**Para recriar:** No Power BI Desktop → New Parameter → Numeric Range, min=1, max=20, increment=1, default=10.

---

### Medidas: Pasta `MKTSHARE` (29 medidas)

**Tabela:** `_Medidas`
**Motivo:** Todas as medidas dependiam de `fact_COMP_sales` — deletadas junto com a tabela.
**Dependências:** Pagina "Market Share" e pagina "Leaderboard" do Report (ambas deletadas).

| Medida | lineageTag |
|---|---|
| `Total_Sales` | 55fa6e61-564e-4e94-8749-9bb858f5955e |
| `Mkt_Share` | 69dbc6fd-a684-4a10-9dd3-84f490e38ab1 |
| `Brand_Rank` | f13a8682-bfa4-4028-8513-9280f20a62ef |
| `Avg_Sales` | c5602b26-2fea-4331-8fc6-7610f29fbe9f |
| `Growth_Rate` | e5de2977-525f-4224-8a85-32944f462517 |
| `Cml_Sales` | c44b8127-4425-4f37-b7e5-22eb9972a470 |
| `Others_Sales` | 5d92a4c6-f8dd-4678-bc93-235dde78bd81 |
| `Pareto_CmlPct` | dbda831e-88a3-402c-abcd-68ed784c512a |
| `Top_N_Comp` | ea4e52c1-452d-41cc-bb9d-89b5c6b94654 |
| `Total_Sales_Current_Month` | 15a6d25d-4879-45de-a796-41d9e763f8e2 |
| `Rank_Current_Month` | a801d739-0610-4724-8a98-328d4b20b678 |
| `Rank_Previous_Month` | c5f38bba-097b-4358-a3fb-3084f54222f4 |
| `_Current_Month` | aaed9158-ff95-4b15-b03f-91f9ea128590 |
| `_Previous_Month` | 4357c2a9-cbe7-4bea-8f9a-cfa72d8c004e |
| `Total_Sales_Previous_Month` | 6707ff88-dcc2-4cab-8d19-0eede0938f72 |
| `Rank_Difference` | a8a80ad3-fd7e-465b-82e7-70bb5e0a6aab |
| `Avg_Growth_Rate` | e7c23aa2-b040-405f-a5d2-c2873fb8a43f |
| `Growth_Rate_StdDev` | b28f43b2-8e73-470f-9892-6eef9bcd86be |
| `Growth_Rate_Market` | c08d08dc-084c-4211-ba6f-661af8b97310 |
| `Market_Performance_Ratio` | fc1d7a50-9993-4830-8f24-7bfbc2b48caa |
| `Total_Sales_Market` | 29a6a330-0bfd-44f8-9051-77b2525c0417 |
| `Avg_Mkt_Sales` | dc5f15da-40c8-4822-8b77-166fac749c08 |
| `period_filtered` | dd54b9c2-cf60-4694-b54a-72d4c89cdb47 |
| `Competitor_Count` | 854300c3-f04f-4c7d-bc16-3289cbcf3b34 |
| `Growth_Rate_OH` | 996795d2-07b9-46b6-a7f6-a8d00b4de456 |
| `Total_Sales_OH` | d4a907c7-4dbf-4715-8a24-6da6cf2aa751 |
| `Growth_Rate_Market_StdDev` | 223955a7-a92a-4a01-873a-eaee5f039809 |
| `'Total_Market_Sales (S/OH)'` | c3a7ae08-f642-45f0-babd-93550247205d |
| `Avg_Mkt_Growth_Rate` | e39d8d45-8315-4f6e-827a-efbe2309aad4 |

**DAX selecionados para referência:**

```dax
-- Mkt_Share
DIVIDE([Total_Sales], CALCULATE([Total_Sales], ALL(fact_COMP_sales[Brand])))

-- Brand_Rank
RANKX(ALLSELECTED(fact_COMP_sales[Brand]), [Total_Sales], , DESC, DENSE)

-- Growth_Rate
VAR CurrentSales = [Total_Sales_Current_Month]
VAR PrevSales = [Total_Sales_Previous_Month]
RETURN IF(ISBLANK(PrevSales), 0,
    IF(PrevSales = 0, BLANK(), (CurrentSales - PrevSales) / PrevSales))

-- Cml_Sales
VAR TotalSalesContexto = [Total_Sales]
VAR Acum = CALCULATE([Total_Sales], FILTER(ALLSELECTED(fact_COMP_sales[Brand]),
    [Total_Sales] > 0 && [Total_Sales] >= TotalSalesContexto))
RETURN IF(ISBLANK([Total_Sales]), BLANK(), Acum)

-- Others_Sales
VAR Top_N = 'z.dynamic_Top_N_Competitors'[z.dynamic_Top_N_Competitors Value]
VAR TopNBrands = TOPN(Top_N, ALLSELECTED(fact_COMP_sales[Brand]), [Total_Sales], DESC)
RETURN CALCULATE([Total_Sales], EXCEPT(ALLSELECTED(fact_COMP_sales[Brand]), TopNBrands))

-- Growth_Rate_Market
VAR CurrentSalesMercado = [Total_Sales_Market]
VAR PrevSalesMercado = CALCULATE([Total_Sales_Market],
    PREVIOUSMONTH(dim_calendar[Date]), REMOVEFILTERS(fact_COMP_sales[Brand]))
RETURN IF(PrevSalesMercado = 0, BLANK(), (CurrentSalesMercado - PrevSalesMercado) / PrevSalesMercado)

-- Total_Sales_Market
CALCULATE(SUM(fact_COMP_sales[Sales]), REMOVEFILTERS(fact_COMP_sales[Brand]))

-- 'Total_Market_Sales (S/OH)'
CALCULATE('_Medidas'[Total_Sales_Market], fact_COMP_sales[Brand] <> "OrganiHaus")
```

*DAX completo de todas as 29 medidas recuperavel no git history do arquivo `tables/_Medidas.tmdl` (commit anterior ao de remoção: sessão 2990b90f, 2026-05-29).*

---

### Pagina: "Market Share" (Report)

**ID da pagina:** `46afe0a70d88c03a6855`
**Motivo:** Pagina dedicada ao Market Share — removida junto com a feature.
**Visuais:** 23 visuais (cards KPI, line charts, bar chart, pie chart, combo chart Pareto).
**Slicers usados:** `fact_COMP_sales[Marketplace]`, `fact_COMP_sales[Amazon Family]`, `fact_COMP_sales[Brand]`, `dim_calendar[Year]`, `dim_calendar[Month Abrev]`, `z.dynamic_mkt_metrics_qtde[Metric]`

*Conteudo completo da pasta `pages/46afe0a70d88c03a6855/` recuperavel no git history do repositorio MAE Dashboard (working copy).*

---

## 2026-06-01 — Remoção de Parametros de Path e Funcoes de M

Para publicar no Power BI Service com refresh agendado via gateway, todos os paths de fontes de dados precisam ser strings literais estaticas. Os parametros e funcoes abaixo foram removidos das `expressions.tmdl`.

---

### Parametros de Path (8 expressoes)

**Motivo:** Parametros `IsParameterQuery=true` com paths dinamicos bloqueiam o gateway do PBI Service. Paths foram substituidos por strings literais diretas em cada query consumidora.

| Expressao | Valor original | Usado por |
|---|---|---|
| `SharedDrivesFolder` | `"G:\Shared drives"` | Raiz de todos os outros parametros de path |
| `path_to_files` | `SharedDrivesFolder & "\OrganiHaus\3.1 - OH Data & Reports\"` | `raw_lifeCycle` (comentado), `aux_first_available` (comentado) |
| `path_to_MAE` | `SharedDrivesFolder & "\OrganiHaus\3.1 - OH Data & Reports\market_analyser_extractor_mae"` | `de_para_file`, `de_para_file_new`, `new_output_mae` (comentado), `old_output_mae` (comentado) |
| `path_to_DD` | `SharedDrivesFolder & "\OrganiHaus\2.2 - OH Ranking & PPC\Market Research\Market Share\Data Dive"` | `COMP_sales` (comentado) — Market Share |
| `path_to_KW` | `SharedDrivesFolder & "\OrganiHaus\3.1 - OH Data & Reports\Data Base Keyword and Ranking\DataBase Keyword and Ranking\2. Keyword\Helium10\Keyword Tracker"` | `fact_KW_tracker` (comentado) |
| `de_para_file` | `path_to_MAE & "\Competitors Mapping\MAE Competitors - Editado v2.xlsx"` | `CA`, `UK`, `US`, `EU` (comentados) |
| `de_para_file_new` | `path_to_MAE & "\Competitors Mapping\MAE Competitors - Editado v3.xlsx"` | `CA`, `UK`, `US`, `EU` (comentados) |
| `de_para_temp` | `SharedDrivesFolder & "\OrganiHaus\3.1 - OH Data & Reports\z_personal_folders\lucca_lanzellotti\Projetos\MAE\Marketshare\DE-PARA PALEATIVO - MARKET SHARE.xlsx"` | Nunca usado ativamente — legado do Market Share |

---

### Funcoes M removidas (3 expressoes)

#### `GetCompetitorData`

**Motivo:** Funcao que recebia `path as text` e chamava `File.Contents(path)` — PBI Service nao consegue registrar a fonte de dados porque o path e dinamico (depende do parametro da funcao). Substituida por queries inline em CA/UK/US/EU.
**Usado por:** `CA`, `UK`, `US`, `EU` (agora com queries inline)

**Definição M original:**
```m
// Função: GetCompetitorData
(
    planilha as text,
    marketplaceCode as text,
    countries as list,
    path as text
) =>
let
    Source = Excel.Workbook(File.Contents(path), null, true),
    sheetData = Source{[Item=planilha, Kind="Sheet"]}[Data],
    promotedHeaders = Table.PromoteHeaders(sheetData, [PromoteAllScalars=true]),
    changedType = Table.TransformColumnTypes(promotedHeaders, {
        {"Native Family", type text}, {"ASIN", type text}, {"Brand", type text}}),
    expandedData = 
        if List.Count(countries) > 1 then
            Table.Combine(List.Transform(countries,
                (country) => Table.AddColumn(changedType, "Country", each country)))
        else
            Table.AddColumn(changedType, "Country", each countries{0}),
    addedMarketplace = Table.AddColumn(expandedData, "Marketplace", each marketplaceCode),
    selectedColumns = Table.SelectColumns(addedMarketplace,
        {"Marketplace", "ASIN", "Native Family", "Brand", "Country"})
in
    selectedColumns
```

---

#### `fnGetCSVFromFolder`

**Motivo:** Funcao que recebia `path_to_KW as text` e chamava `Folder.Files(path_to_KW)` — mesmo problema do `GetCompetitorData`. Substituida por query inline em `fact_KW_tracker`.
**Usado por:** `fact_KW_tracker` (agora com query inline)

**Definição M original:**
```m
let
    fnGetCSVsFromFolder = (path_to_KW as text) =>
    let
        Source = Folder.Files(path_to_KW),
        CSVsOnly = Table.SelectRows(Source,
            each Text.EndsWith([Extension], ".csv", Comparer.OrdinalIgnoreCase)),
        ImportCSVs = Table.AddColumn(CSVsOnly, "ContentTable", each 
            let
                csvTable = Table.PromoteHeaders(
                    Csv.Document([Content],
                        [Delimiter = ",", Columns = null, Encoding = 65001,
                         QuoteStyle = QuoteStyle.Csv]),
                    [IgnoreErrors = true]
                ),
                fileName = [Name],
                withFileName = Table.AddColumn(csvTable, "FileName", each fileName, type text)
            in
                withFileName),
        Combined = Table.Combine(ImportCSVs[ContentTable])
    in
        Combined
in
    fnGetCSVsFromFolder
```

---

#### `bigQuery_customFunction`

**Motivo:** Funcao que recebia `project_id as text` e construia a conexao BigQuery dinamicamente a partir do string. Substituida por queries inline em `fAllListingsReport` e `dgradeAndResellAmazonFoundSkus`.
**Usado por:** `fAllListingsReport`, `dgradeAndResellAmazonFoundSkus`

**Definição M original:**
```m
let
    dataInput = (project_id as text) =>
    let
        project_name = Text.Split(project_id, "."){0},
        dataset_name = Text.Split(project_id, "."){1},
        view_or_table_name = Text.Split(project_id, "."){2},
        bigQuerySource = GoogleBigQuery.Database([BillingProject=project_name]),
        bigQueryProjectName = bigQuerySource{[Name=project_name]}[Data],
        bigQueryDataset = bigQueryProjectName{[Name=dataset_name, Kind="Schema"]}[Data],
        viewOrTable = bigQueryDataset{[Name=view_or_table_name, Kind="View"]}[Data]
    in
        viewOrTable
in
    dataInput
```

---

### Expressoes de Market Share no `expressions.tmdl` (3 expressoes)

**Motivo:** Dependiam de `fact_COMP_sales` (tabela deletada em 2026-05-29). Removidas em 2026-06-01 na mesma passagem de limpeza de paths dinamicos.

#### `COMP_sales`

**Descricao:** Carregava CSVs mensais de market share da pasta DataDive.
**Fonte:** `G:\Shared drives\OrganiHaus\2.2 - OH Ranking & PPC\Market Research\Market Share\Data Dive\`

#### `aux_comp_sales`

**Descricao:** Carregava historico consolidado de vendas de competidores (CSV manual do time de Marketing).
**Fonte:** `G:\Shared drives\OrganiHaus\2.2 - OH Ranking & PPC\Market Research\Market Share\Data Dive\marketshare.csv`

#### `ProcessCSVFile`

**Descricao:** Funcao M que processava cada arquivo CSV de market share (extraia dados de ASINs, vendas, periodo a partir do nome do arquivo).
**Usado por:** `COMP_sales` (agora deletada).

*DAX/M completo das 3 expressoes recuperavel no git history do arquivo `expressions.tmdl` (commit anterior: sessão 2990b90f, 2026-05-29).*

---

## Itens auditados mas mantidos

| Item | Tipo | Decisao | Motivo |
|---|---|---|---|
| `aux_first_available` | Tabela Import | Manter | Ainda conectada ao modelo via relacionamento com `dim_country` e `dim_featured_brands`. Fonte em `Marketshare\First Available Competitors.xlsx` — desatualizada mas sem impacto em erros visuais |
| `COMP_sales` (pasta DataDive Rank_Radar) | Expressao — sem relacao com Market Share | N/A | Confusao de nome: a `COMP_sales` de Market Share foi deletada; a pasta de Rank Radar e uma fonte diferente (`fact_RankRadar_KWs`) |
| `zz_Refresh_Control` | Tabela | Manter | Usada como timestamp de ultimo refresh |

---

**Documentacao:** Eleven Brands · OrganiHaus - Market Research · Dados & Analytics
