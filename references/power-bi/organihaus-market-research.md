# OrganiHaus - Market Research (Dashboard)

## Visao Geral

Dashboard de inteligencia de mercado da OrganiHaus. Cobre monitoramento de preco e promocoes de concorrentes (MAE), performance de keywords e ranking organico (DataDive Rank Radar / Helium10), Search Query Performance (SQP) da Amazon e rastreamento de hijackers de Buy Box.

**Caminho do modelo (producao):** `G:\Shared drives\OrganiHaus\3.1 - OH Data & Reports\Dashboards\OrganiHaus - Market Research\OrganiHaus - Market Research.SemanticModel`

**Arquitetura:** Composite Model — Import para dados MAE-especificos + DirectQuery ao OrganiHaus - Base Tables (para SKUs). Refresh agendado via gateway no Power BI Service.

**Fora do escopo desta versao:** Market Share (fonte manual desatualizada, responsavel saiu — tabelas, medidas e pagina removidas).

---

## Arquitetura de Fontes

O modelo tem **quatro origens principais** de dados:

### 1. MAE — Market Analyser Extractor (scraping de listings Amazon)

Ferramenta customizada que extrai dados de listings da Amazon (preco, rating, estoque, promo, cupom, PED, merchant) e gera um arquivo CSV consolidado.

| Expressao | Arquivo | Descricao |
|---|---|---|
| `new_output_mae` | `market_analyser_extractor_mae\OUTPUT\OUTPUT_FILE.csv` | Output atual do MAE (UTF-8, parsing robusto de datas e precos). RangeStart = set/2025. earlyDateFilter aplicado antes das transformacoes caras. |
| `old_output_mae` | Pasta `market_analyser_extractor_mae\OUTPUT\Old\` | Historico de outputs anteriores com schema compativel |
| `fact_output` | Combinacao de `old_output_mae` + `new_output_mae` | Tabela base de todos os listings monitorados, deduplicada por {Date, ASIN, Brand, Country} |

**Tabela central: `fact_mae`**

Unificacao de OH e Competitors em uma unica tabela com coluna discriminadora `Brand_Type`:
- `Brand_Type = "OrganiHaus"` — dados de listings da OrganiHaus
- `Brand_Type = "Competitor"` — dados de listings de concorrentes

Substituiu as antigas tabelas separadas `OH_Output` e `COMP_Output`. Relacionamento ativo com `OH ASINs` (por `Key: Country | ASIN`) e com `Competitors ASINs` (por `Key Country | ASIN | Brand`).

**Colunas principais de `fact_mae`:** Date, ASIN, Price, Ratings Stars, Number of ratings, Name, Link, Stock, Coupon, Brand, Brand_Type, Deal, Badge, Merchant, Prime, PED (Prime Exclusive Discount), Limited Time Deal, List Price, Product Category GL, Prev Month Qty, Country, Key: Country | ASIN, Marketplace, Key Marketplace | ASIN, Coupon Type, Coupon Value, Promotion Type, Full Price, Final Price, Total Discount Value, Coupon Price, BSR 1 Rank, BSR 1 Category, BSR 2 Rank, BSR 2 Category

### 2. DataDive Rank Radar — Keywords e Ranking

Exportacoes CSV de rastreamento de posicao organica por keyword, processadas por uma funcao customizada `ProcessDDFile`.

| Expressao | Fonte | Descricao |
|---|---|---|
| `fact_RankRadar_KWs` | Pasta `Data Base Keyword and Ranking\DataBase Keyword and Ranking\2. Keyword\DataDive\Rank_Radar\` | Todos os CSVs da pasta, processados, expandidos, filtrados por `RangeStart` (parametro de data) |

### 3. SQP — Search Query Performance (Amazon Seller Central)

Dados de Search Query Performance da Amazon — impressoes, cliques, adicoes ao carrinho e compras por ASIN e keyword, por semana.

| Expressao | Fonte | Descricao |
|---|---|---|
| `fact_seller_utils_SQP` | CSV local — `code_repository\sqp_downloader\processed\resultado_final.csv` | 42 colunas tipadas: year, week, inventory_region_code, country_code, start_date, asin, search_query, search_query_score, search_query_volume, IMP/CLK/CART/PUR (total_count + asin_count + share + price_median + shipping_counts) |
| `fact_search_query_performance` | Transformacao de `fact_seller_utils_SQP` | Adiciona chaves compostas (Key Country|ASIN, Year-Week, Key SV, Key SQ), deduplica |

### 4. Arquivos de configuracao e controle

| Arquivo | Expressao/Tabela | Descricao |
|---|---|---|
| `01 - OH Sourcing and Orders\01.1 - Suppliers - Active\Product Information and Pricing Database.xlsx` abas `skusByRegion`, `hierarchy`, `dimensions` | `SKUs (raw)` → `SKUs` | Dimensao mestre de produtos OrganiHaus. SKUs agora em DirectQuery ao Base Tables. |
| `standalone_files\db_promotion_tracker.xlsx` aba `db` | `fact_promotion_tracker` | Planejamento de promocoes com datas, preco simulado, margens |
| `market_analyser_extractor_mae\Competitors Mapping\MAE Competitors - Editado v2.xlsx` e `v3.xlsx` | Expressoes `CA`, `UK`, `US`, `EU` (queries inline) | Mapeamento de ASINs de concorrentes por marketplace. Paths literais diretos (sem parametros). |
| `standalone_files\db_abc_classification.xlsx` | `fact_abc_classification` | Classificacao ABC de produtos |
| `standalone_files\db_life_cycle.xlsx` | `raw_lifeCycle` | Ciclo de vida dos SKUs |

---

## Funcoes e Expressoes Globais

| Nome | Tipo | Descricao |
|---|---|---|
| `ProcessDDFile` | Funcao M | Processa CSVs de Rank Radar (DataDive), extrai keyword, rank, search volume, data, Amazon Family |
| `TransformMAEOutput` | Funcao M | Processa cada arquivo CSV legado do MAE |
| `fact_search_query_performance` | Expressao tabela | Transformacao central do SQP: add chaves, deduplica |
| `fact_output` | Expressao tabela | Combina old + new output do MAE, deduplica por Date|ASIN|Brand|Country |
| `RangeStart` | Parametro (Date) | Data inicial para filtro do MAE e Rank Radar (default: 2025-09-01) |
| `RangeEnd` | Parametro (Date) | Data final (parametro de controle — atualmente nao ativo no filtro principal) |

> Todas as expressoes que anteriormente usavam parametros de path (`path_to_MAE`, `path_to_files`, `SharedDrivesFolder`, `GetCompetitorData`, etc.) foram migradas para strings literais diretamente no `File.Contents()` / `Folder.Files()` — necessario para refresh via gateway no PBI Service.

---

## Tabelas do Modelo

### fact_mae
**Categoria:** Fato unificado — Listings OrganiHaus e Concorrentes
**Fonte:** `fact_output` (dados MAE combinados), com coluna calculada `Brand_Type`
**Coluna discriminadora:** `Brand_Type` — "OrganiHaus" para OH, "Competitor" para concorrentes
**Colunas:** Date, ASIN, Brand, Brand_Type, Price, Final Price, Full Price, Rating Stars, Number of ratings, Coupon, Coupon Type, Coupon Value, Deal, Badge, Merchant, Prime, PED, Limited Time Deal, List Price, Promotion Type, Total Discount Value, Stock, Prev Month Qty, Country, Marketplace, Key: Country | ASIN, Key Marketplace | ASIN, Key Country | ASIN | Brand, Date Created, BSR 1 Rank, BSR 1 Category, BSR 2 Rank, BSR 2 Category

### OH ASINs
**Categoria:** Dimensao — ASINs OrganiHaus
**Fonte:** `Table.SelectRows(fact_mae, each [Brand_Type] = "OrganiHaus")` — filtro direto de `fact_mae`
**Transformacoes:** Renomeia Sales Region para Marketplace; cria chaves compostas (SKU Limpo = `Country | Base SKU`, Key Marketplace | Native Family, Key Country | ASIN, Key Country | Amazon Family, Key Country | Native Family); adiciona Brand = "OrganiHaus"; filtra ASIN nao nulo, Marketplace != "Erro"/"BR"/"MX"; deduplica por SKU Limpo
**Colunas:** SKU Limpo, Key Marketplace | Native Family, Key Country | ASIN, Key Country | Native Family, Key Country | Amazon Family, Brand, Country, Base SKU, Marketplace, Native Family, ASIN, Color Name, Size Name

### Competitors ASINs
**Categoria:** Dimensao — ASINs de Concorrentes
**Fonte:** `Table.Combine({CA, EU, UK, US})` — cada um com query inline carregando diretamente do Excel (v2 + v3)
**Transformacoes:** Padroniza tipos, cria Key Marketplace|ASIN e Key Marketplace|Native Family, adiciona coluna `Highlight` (1 se Brand esta em `dim_featured_brands`), cria Key Country|ASIN e Key Country|Native Family, filtra ASINs validos, adiciona Key Country|ASIN|Brand
**Colunas:** Marketplace, ASIN, Native Family, Brand, Country, Key Marketplace|ASIN, Key Marketplace|Native Family, Highlight, Key Country|ASIN, Key Country|Native Family, Key Country|ASIN|Brand

### ASIN Brand
**Categoria:** Dimensao auxiliar — lookup de Brand por ASIN
**Fonte:** Combinacao de `OH ASINs` + `Competitors ASINs`, seleciona Brand/Native Family/ASIN, deduplica por ASIN; adiciona Brand Type ("OrganiHaus" ou "Competitor")

### fact_RankRadar_KWs
**Categoria:** Fato — Ranking organico por keyword (DataDive)
**Fonte:** Pasta `DataBase Keyword and Ranking\2. Keyword\DataDive\Rank_Radar\` — todos os CSVs processados por `ProcessDDFile`
**Transformacoes:** Ordena por Date Created decrescente, remove erros, expande colunas processadas, filtra por `RangeStart`, adiciona `Key Country | Amazon Family`
**Colunas:** Name (arquivo), Search Terms, Highlight, Search Volume, Top Variation, originalDate, rank, Amazon Family, year, month, Country, Key Country | Amazon Family

### fact_promotion_tracker
**Categoria:** Fato — Planejamento de Promocoes
**Fonte:** Excel `standalone_files\db_promotion_tracker.xlsx` aba `db`
**Colunas principais:** Country, Native Family, ASIN, Base SKU, Title Description, Category, Objective, Current Price, Simulated Price, % Coupon Discount, Amount Discount, Commercial Margin, % Operational Margin, startDate, endDate, pricePromotionAction, actionDescription, Status, Amazon Inventory, Weekly Velocity, Overstock, Aging Units

### fact_sqp_asin
**Categoria:** Fato — SQP nivel ASIN (unpivotado)
**Fonte:** Derivada de `fact_search_query_performance`
**Transformacoes:** Seleciona colunas de ASIN-level, renomeia IMP/CLK/CART/PUR_asin_count para nomes curtos, UnpivotOtherColumns gerando coluna "Funnel Category" (IMP|CLK|CART|PUR) e "Count", adiciona Key Totals = `Key SV | Funnel Category`
**Granularidade:** Year-Week x Country x ASIN x Search Query x Funnel Category

### fact_sqp_sv
**Categoria:** Fato — SQP nivel Search Query (Search Volume)
**Fonte:** Derivada de `fact_search_query_performance`
**Transformacoes:** Agrupa por Year-Week x country x search_query, MAX(search_query_volume) e MAX(search_query_score); deduplica por Key SV
**Granularidade:** Year-Week x Country x Search Query

### fact_sqp_sv_funnel_totals
**Categoria:** Fato — SQP totais de mercado por keyword (unpivotado)
**Fonte:** Derivada de `fact_search_query_performance`
**Transformacoes:** Seleciona totais de mercado (IMP/CLK/CART/PUR_total_count), unpivota por Funnel Category, adiciona Key Totals = `Year-Week | Country | search_query | Funnel Category`; deduplica por Key Totals
**Granularidade:** Year-Week x Country x Search Query x Funnel Category (totais, nao por ASIN)

### dim_sq
**Categoria:** Dimensao — Search Queries
**Fonte:** Derivada de `fact_search_query_performance`, seleciona country_code e search_query, deduplica por Key SQ
**Colunas:** country_code, search_query, Key SQ

### dim_calendar
**Categoria:** Dimensao temporal
**Fonte:** Calculada em M de 2023-01-01 ate hoje+14 dias
**Colunas:** Date, Year, Month, Month Abrev, Quarter Q, Week Number 544, Year-Week 544, Year-Month, today, e outros campos do calendario 4-4-5

### dim_country / dim_marketplace
**Categoria:** Dimensoes de Regiao
**Fonte:** Derivadas de `SKUs (raw)`, filtradas para CA/DE/ES/FR/GB/IT/US
**Colunas:** Marketplace (= Country), Region (= Sales Region)

### dim_featured_brands
**Categoria:** Dimensao de configuracao — Marcas em destaque
**Fonte:** Lista hardcoded em M com ~24 marcas monitoradas (OrganiHaus, TeoKJ, COMFY-HOMI, CHICVITA, LA JOLIE MUSE, XUANGO, Maliton, Goodpick, MINTWOOD Design, etc.)

### dim_important_competitors
**Categoria:** Dimensao de configuracao — Categorias de competidores
**Fonte:** DATATABLE embutido (Binary comprimido), colunas Id e Category

### SKUs
**Categoria:** Dimensao mestre de produtos
**Fonte:** DirectQuery ao OrganiHaus - Base Tables (via XMLA). `SKUs (raw)` + `dgradeAndResellAmazonFoundSkus`, com multiplas chaves compostas (Sales Region|SKU, Sales Region|ASIN, Sales Region|FNSKU, Sales Region|Amazon Family, Country|SKU, Country|ASIN, Country|FNSKU, Inventory Region|SKU, Inventory Region|ASIN, Inventory Region|FNSKU)

### PARAM_AvailableDates / PARAM_AvailableDates_Comp
**Categoria:** Parametros de data para comparacao de keywords (Keyword Gain/Loss)
**Fonte:** Derivadas de `fact_RankRadar_KWs`, lista de datas disponíveis como slicer de selecao de periodo

---

## Measures — _Medidas

### Dominio: MAE_OH (OrganiHaus — Preco e Promo)

| Medida | Descricao |
|---|---|
| `OH_last_price` | Ultimo preco Full Price do SKU OrganiHaus |
| `OH_last_final_price` | Ultimo Final Price (apos descontos) |
| `OH_avg_price` | Media de Full Price |
| `OH_avg_final_price` | Media de Final Price |
| `OH_min_price` / `OH_max_price` | Min/Max de Final Price |
| `OH_mode_final_price` | Preco modal (mais frequente) |
| `OH_mode_final_price_frequency` | Frequencia do preco modal |
| `OH_last_final_price_evolution` | ROUND(AVERAGE(Final Price), 2) — para grafico de evolucao |
| `OH_avg_PED` / `OH_min_PED` / `OH_max_PED` | Estatisticas de Prime Exclusive Discount |
| `OH_last_PED` | Ultimo PED registrado |
| `OH_coupon_value` | Valor do cupom ativo |
| `OH_promo_type` | Tipo de promocao atual |
| `OH_deal` / `OH_deal_last_date` | Existencia e data do deal |
| `OH_last_QTY` | Bought Past Month (quantidade vendida no mes) |
| `OH_avg_rating` | Media de Ratings Stars |
| `OH_link` | Link do listing |
| `OH_final_price_deal` / `OH_final_price_coupon` | Preco com deal / preco com cupom para grafico de evolucao |
| `OH_distinct_asin_count` | Count de ASINs OrganiHaus |
| `OH_list_price` | List Price (preco de lista) |
| `OH_current_final_price` | Final Price no dia selecionado |
| `OH_hijackers` | Count de merchants diferentes de "Amazon" e "OrganiHaus" |

### Dominio: MAE_OH\BSR (OrganiHaus — Best Seller Rank)

| Medida | Descricao |
|---|---|
| `OH_last_BSR1` | Rank BSR1 mais recente (OH) |
| `OH_last_BSR1_cat` | Categoria BSR1 mais recente (OH) |
| `OH_best_BSR1` | MIN(BSR1 Rank) no periodo selecionado (OH) — menor = melhor |
| `OH_avg_BSR1` | AVG(BSR1 Rank) no periodo (OH) |
| `OH_last_BSR2` | Rank BSR2 mais recente (OH) |
| `OH_last_BSR2_cat` | Categoria BSR2 mais recente (OH) |

### Dominio: MAE_COMP (Competidores — Preco e Promo)

> **Padrao DAX das medidas COMP:** `VAR _families = VALUES('OH ASINs'[Key Country | Native Family])` capturado ANTES do `CALCULATE`, seguido de `REMOVEFILTERS('OH ASINs')` + `TREATAS(_families, 'Competitors ASINs'[Key Country | Native Family])`. Isso resolve o problema de slicer de OH ASINs anulando dados de competidores apos a unificacao em `fact_mae`.

| Medida | Descricao |
|---|---|
| `COMP_avg_price` / `COMP_min_price` / `COMP_max_price` | Estatisticas de Full Price dos competidores |
| `COMP_avg_final_price` | Media de Final Price de competidores |
| `COMP_last_price` / `COMP_last_final_price` | Ultimo preco Full/Final de competidor |
| `COMP_last_final_price_evolution` | ROUND(AVERAGE(Final Price), 2) — para grafico |
| `COMP_W_avg_final_price` | Media ponderada de Final Price de competidores |
| `COMP_mode_final_price` / `COMP_mode_final_price_frequency` | Preco modal dos competidores |
| `COMP_avg_rating` | Media de rating dos competidores |
| `COMP_coupon_value` / `COMP_promo_type` | Cupom e promo atual dos competidores |
| `COMP_deal` / `COMP_deal_last_date` | Deal de competidores |
| `COMP_last_QTY` | Bought Past Month dos competidores |
| `COMP_link` | Link de listing do competidor |
| `COMP_price_variation` | Variacao de preco do competidor em relacao ao periodo anterior |
| `COMP_total_asins` / `COMP_asins_price_down` / `COMP_asins_price_up` / `COMP_asins_neutral` | Contagem de ASINs por direcao de variacao de preco |
| `COMP_distinct_asin_count` | Count de ASINs de competidores |
| `COMP_list_price` | List Price dos competidores |
| `COMP_last_PED_evolution` | PED dos competidores para grafico |
| `COMP_badge_count` / `COMP_badge_exists` | Badges (Best Seller, Amazon Choice) |
| `COMP_final_price_deal` / `COMP_final_price_coupon` | Preco com deal / cupom para grafico |
| `COMP_current_final_price` | Final Price no dia selecionado |

### Dominio: MAE_COMP\BSR (Competidores — Best Seller Rank)

| Medida | Descricao |
|---|---|
| `COMP_last_BSR1` | Rank BSR1 mais recente (COMP) — REMOVEFILTERS+TREATAS |
| `COMP_last_BSR1_cat` | Categoria BSR1 mais recente (COMP) |
| `COMP_best_BSR1` | MIN(BSR1 Rank) no periodo (COMP) |
| `COMP_avg_BSR1` | AVG(BSR1 Rank) no periodo (COMP) |
| `COMP_last_BSR2` | Rank BSR2 mais recente (COMP) |
| `COMP_last_BSR2_cat` | Categoria BSR2 mais recente (COMP) |

### Dominio: MAE_AUX (Analise de Preco Comparativa e BSR)

| Medida | Descricao |
|---|---|
| `avg_price_ratio` | OH Final Price / COMP Avg Final Price |
| `w_avg_price_ratio` | OH Final Price / COMP Weighted Avg Final Price |
| `price_ratio_asin` | OH Avg Final Price / COMP Last Final Price (nivel ASIN) |
| `price_alert_general` | "Alert - Price Change" se ABS(COMP_price_variation) >= 10% |
| `price_alert_asin` / `price_alert_brand_summary` / `price_alert_by_hierarchy` | Alertas de variacao de preco em niveis diferentes |
| `is_price_alert` | Flag binario de alerta de preco |
| `has_valid_data` | Verifica se ha dados validos no periodo |
| `is_featured_competitor` | 1 se dim_featured_brands esta filtrado |
| `last_update_date` | MAX(fact_mae[Date]) para competidores |
| `count_total_asins` / `count_price_down` / `count_price_up` / `count_price_neutral` / `count_price_under` / `count_price_over` / `count_price_equal` | Contagens de ASINs por status de preco |
| `BSR1_advantage` | COMP_last_BSR1 - OH_last_BSR1 (positivo = OH melhor posicao) |
| `BSR1_status` | "OH Better" / "COMP Better" / "Equal" |

### Dominio: SQP (Search Query Performance)

| Medida | Descricao |
|---|---|
| `IMP_OH` / `IMP_Total` | Impressoes OrganiHaus e totais do mercado |
| `CLK_OH` / `CLK_Total` | Cliques OH e totais |
| `A2C_OH` / `A2C_Total` | Adicoes ao carrinho OH e totais |
| `PUR_OH` / `PUR_Total` | Compras OH e totais |
| `CTR_OH` / `CTR_Total` | Click-Through Rate OH e total |
| `A2C_Rate_OH` / `A2C_Rate_Total` | Taxa de A2C OH e total |
| `PUR_Rate_OH` / `PUR_Rate_Total` | Taxa de compra OH e total |
| `CVR_OH` / `CVR_Total` | Conversion Rate OH e total (PUR/IMP) |
| `IMP_Share` / `CLK_Share` / `A2C_Share` / `PUR_Share` | Share de OH em relacao ao mercado |
| `IMP_ASIN_Share` | Share de impressoes por ASIN |
| `SQ Total Search Vol` | Volume de busca total das keywords selecionadas |
| `SQ Score` | Search Query Score (relevancia da keyword) |
| `SQ Avg Search Vol` | Volume medio de busca |
| `Impr per Search` | DIVIDE(IMP_Total, SQ Total Search Vol) |
| `delta_CTR` / `delta_CVR` / `delta_A2C_Rate` / `delta_PUR_Rate` | Variacao de taxa OH vs mercado |
| `ui_delta_CTR` / `ui_delta_CVR` / `ui_delta_A2C_Rate` / `ui_delta_PUR_Rate` | Formatacao visual dos deltas |
| `recommendations` | Texto de recomendacao baseado em SQP |

### Dominio: Keywords (DataDive Rank Radar)

| Medida | Descricao |
|---|---|
| `DD_Indexed_KWs` | DISTINCTCOUNT de keywords indexadas |
| `DD_Sum_Search_Vol` | SUM de Search Volume |
| `DD_Avg_Search_Vol` | Media de Search Volume por keyword |
| `DD_Avg_Rank` / `DD_Median_Rank` | Rank medio e mediano |
| `DD_Weighted_Avg_Rank` | Rank medio ponderado por Search Volume |
| `DD_Mode_Rank` / `DD_Rank_Frequency` | Rank modal e sua frequencia |
| `DD_Rank_StdDev` | Desvio padrao do rank |
| `DD_%_Top10` / `DD_%_Top30` | % de keywords rankeadas no Top 10 / Top 30 |
| `DD_Total_KWs` | Total de keywords monitoradas (incluindo nao indexadas) |
| `DD_Opportunity` | Score de oportunidade por keyword |
| `DD_Rank_Change` | Variacao de rank periodo a periodo |
| `KW_Status` | Label de status (New / Lost / Remained) |
| `KW_New` / `KW_Lost` / `KW_Remained` | Contagem de keywords por status |
| `Last_Search_Volume` | Volume de busca mais recente por keyword |

### Dominio: Promotions (Promotion Tracker)

| Medida | Descricao |
|---|---|
| `ActivePromotions` | Count de promocoes ativas no periodo |
| `ActivePromoNextWeek` | Count de promocoes que iniciam na proxima semana |
| `PED Count` / `Best Deal Count` / `Lightning Deal Count` | Contagens por tipo de promocao |
| `Price Increase Count` / `Price Decrease Count` | Count de acoes de preco no periodo |
| `StatusPromocaoSKU` | Status de promocao por SKU para o pivot table (celula colorida) |

---

## Tabelas Auxiliares e Dinamicas (Field Parameters)

| Tabela | Descricao |
|---|---|
| `z.dynamic_time_frame_switch` | Alterna granularidade temporal (diario/semanal/mensal) para graficos |
| `z.dynamic_SQP_metrics_prim_ABS` | Metrica primaria SQP — valores absolutos |
| `z.dynamic_SQP_metrics_prim_REL` | Metrica primaria SQP — valores relativos (%) |
| `z.dynamic_SQP_metrics_prim_SQ` | Metrica primaria SQP — nivel de Search Query |
| `z.dynamic_SQP_metrics_prim_y` | Eixo Y primario SQP |
| `z.dynamic_SQP_metrics_secd_ABS` | Metrica secundaria SQP — absolutos |
| `z.dynamic_SQP_metrics_secd_REL` | Metrica secundaria SQP — relativos |
| `z.dynamic_SQP_metrics_secd_SQ` | Metrica secundaria SQP — Search Query |
| `z.dynamic_SQP_metrics_secd_y` | Eixo Y secundario SQP |
| `z.dynamic_Category_Tracker` | Alterna categoria para tracker |
| `z.dynamic_Price_Alert_Treshold` | Limite de alerta de variacao de preco |
| `z_dynamic_metrics_comp` | Metricas dinamicas para competidores |
| `z_dynamic_metrics_OH` | Metricas dinamicas para OrganiHaus |
| `z_dynamic_metrics_product` | Metricas dinamicas por produto |
| `z_dynamic_price_evo` | Opcoes de preco para grafico de evolucao (Full Price / Final Price / PED) |
| `z_dynamic_promo_evo` | Opcoes de promo para grafico de evolucao (Coupon / Deal / None) |
| `aux_DD_SV` | Auxiliar de Search Volume para DataDive |
| `aux_first_available` | Auxiliar de primeira data disponivel por ASIN/marca |
| `PARAM_AvailableDates` | Datas disponíveis para seletor de periodo (Keyword Tracker) |
| `PARAM_AvailableDates_Comp` | Datas disponíveis para comparacao (Keyword Gain/Loss) |
| `dim_promo_type` | Tipos de promocao (PED, Coupon, Deal, etc.) |
| `zz_Refresh_Control` | Timestamp de ultimo refresh |

---

## Paginas e Visuais

### Pagina: Alerts

Monitoramento de alertas de variacao de preco de concorrentes. Exibe um board de ASINs com variacao significativa vs periodo anterior.

#### Slicers

`dim_marketplace[Marketplace]`, `Competitors ASINs[Native Family]`, `Competitors ASINs[Brand]`, `dim_promo_type[Promotion Type]`, `dim_important_competitors[Category]` (advancedSlicer), `dim_calendar[today]` (advancedSlicer)

#### Visual: KPI Card — Variacao de Preco por Status (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[count_total_asins]` | Total ASINs |
| `_Medidas[count_price_down]` | Price Down |
| `_Medidas[count_price_up]` | Price Up |
| `_Medidas[count_price_neutral]` | Price Neutral |
| `_Medidas[count_price_under]` | Price Under |
| `_Medidas[count_price_over]` | Price Over |
| `_Medidas[count_price_equal]` | Price Equal |

#### Visual: Card — Last Update Date

| Values | `_Medidas[last_update_date]` |

#### Visual: Table — Status por Marketplace (tableEx)

Colunas: `dim_marketplace[Marketplace]`, `_Medidas[current_date]` (label: Update)

#### Visual: Table — Detalhe de ASINs com Alerta (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `ASIN Brand[Native Family]` | |
| | `Competitors ASINs[Brand]` | |
| | `fact_mae[ASIN]` | |
| | `_Medidas[COMP_last_QTY]` | Bought Past Month |
| | `_Medidas[COMP_price_variation]` | Price Variation % |
| | `_Medidas[COMP_last_price]` | Comp. Last Final Price |
| | `_Medidas[COMP_current_final_price]` | Comp. Current Final Price |
| | `_Medidas[price_ratio_asin]` | OH Over Comp. |
| | `_Medidas[OH_avg_final_price]` | OH Avg. Price |
| | `_Medidas[COMP_promo_type]` | Comp. Current Promo |
| | `_Medidas[COMP_link]` | Link |

---

### Pagina: MAE

Analise comparativa de preco entre OrganiHaus e concorrentes — tabelas de preco por SKU e competidor, grafico de evolucao de preco e promo ao longo do tempo.

#### Slicers

`dim_marketplace[Marketplace]`, `OH ASINs[Native Family]`, `Competitors ASINs[Brand]`, `dim_promo_type[Promotion Type]`, `dim_calendar[Date]`, `z.dynamic_time_frame_switch[Time Frame]` (advancedSlicer), `dim_important_competitors[Category]` (advancedSlicer), `z_dynamic_promo_evo[Promo]`, `z_dynamic_price_evo[Price]`

#### Visual: Table — Preco por SKU OrganiHaus (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `OH ASINs[SKU Limpo]` | |
| | `_Medidas[OH_mode_final_price]` | OH Mode Final Price |
| | `_Medidas[OH_mode_final_price_frequency]` | Price Frequency |
| | `_Medidas[OH_min_price]` | OH Min Final Price |
| | `_Medidas[OH_max_price]` | OH Max Final Price |
| | `_Medidas[OH_last_QTY]` | OH Bought Past Month |
| | `_Medidas[avg_price_ratio]` | OH Over Comp |
| | `_Medidas[w_avg_price_ratio]` | OH Over W. Comp |
| | `_Medidas[OH_link]` | OH Link |

#### Visual: Table — Preco por Familia (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `OH ASINs[Native Family]` | |
| | `_Medidas[COMP_avg_final_price]` | Comp. Avg. Final Price |
| | `_Medidas[OH_avg_final_price]` | OH Avg. Final Price |
| | `_Medidas[COMP_avg_price]` | Comp. Avg. Price |
| | `_Medidas[OH_avg_price]` | OH Avg. Price |
| | `_Medidas[COMP_min_price]` | Comp. Min. Price |
| | `_Medidas[OH_last_price]` | OH Last Price |
| | `_Medidas[OH_avg_rating]` | OH Rating Stars |
| | `_Medidas[avg_price_ratio]` | OH Over Comp. |
| | `_Medidas[OH_min_price]` | OH Min. Price |

#### Visual: Table — Preco por ASIN Competidor (tableEx)

| Coluna | Campo | Label |
|---|---|---|
| | `Competitors ASINs[Brand]` | |
| | `Competitors ASINs[ASIN]` | |
| | `_Medidas[COMP_mode_final_price]` | Comp. Mode Final Price |
| | `_Medidas[COMP_mode_final_price_frequency]` | Price Frequency |
| | `_Medidas[COMP_min_price]` | Comp. Min Final Price |
| | `_Medidas[COMP_max_price]` | Comp. Max Final Price |
| | `_Medidas[COMP_last_QTY]` | Comp. Bought Past Month |
| | `_Medidas[COMP_link]` | Comp. Link |

#### Visual: Line Chart — Evolucao de Preco e Promo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` | |
| Y | `_Medidas[COMP_last_final_price_evolution]` | Comp. Avg. Final Price |
| Y | `_Medidas[OH_last_final_price_evolution]` | OH Avg. Final Price |
| Y | `_Medidas[COMP_last_PED_evolution]` | Comp. PED |
| Y | `_Medidas[OH_avg_PED]` | OH PED |
| Y | `_Medidas[COMP_final_price_deal]` | Comp. Deal |
| Y | `_Medidas[OH_final_price_deal]` | OH Deal |
| Y | `_Medidas[COMP_final_price_coupon]` | Comp. Coupon |
| Y | `_Medidas[OH_final_price_coupon]` | OH Coupon |

---

### Pagina: Search Query Performance

Analise de performance organica nas buscas Amazon por keyword — impressoes, cliques, conversao e share do mercado por ASIN e familia.

#### Slicers

`dim_marketplace[Marketplace]`, `dim_country[Marketplace]`, `OH ASINs[Base SKU]`, `dim_calendar[Year]`, `dim_calendar[Week Number 544]`, `fact_sqp_sv[Search Volume]`, `fact_sqp_sv[Search Query Score]`, `dim_sq[search_query]` (textSlicer), `z.dynamic_SQP_metrics_prim_ABS`, `z.dynamic_SQP_metrics_prim_REL`, `z.dynamic_SQP_metrics_prim_SQ`, `z.dynamic_SQP_metrics_secd_ABS`, `z.dynamic_SQP_metrics_secd_REL`, `z.dynamic_SQP_metrics_secd_SQ` (todos advancedSlicer)

#### Visual: KPI Cards — Funil OrganiHaus (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[IMP_OH]` | Impressions |
| `_Medidas[CLK_OH]` | Clicks |
| `_Medidas[A2C_OH]` | Adds to Cart (A2C) |
| `_Medidas[PUR_OH]` | Purchases |

#### Visual: KPI Cards — Funil Total Mercado (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[IMP_Total]` | Impressions |
| `_Medidas[CLK_Total]` | Clicks |
| `_Medidas[A2C_Total]` | Adds To Cart (A2C) |
| `_Medidas[PUR_Total]` | Purchases |

#### Cards Individuais de Taxas

`_Medidas[CTR_OH]`, `_Medidas[CTR_Total]`, `_Medidas[A2C_Rate_OH]`, `_Medidas[A2C_Rate_Total]`, `_Medidas[PUR_Rate_OH]`, `_Medidas[PUR_Rate_Total]`, `_Medidas[CVR_OH]`, `_Medidas[CVR_Total]`, `_Medidas[IMP_Share]`, `_Medidas[CLK_Share]`, `_Medidas[A2C_Share]`, `_Medidas[PUR_Share]`, `_Medidas[SQ Total Search Vol]`, `_Medidas[ui_delta_CTR]`, `_Medidas[ui_delta_CVR]`, `_Medidas[ui_delta_A2C_Rate]`, `_Medidas[ui_delta_PUR_Rate]`

#### Visual: Line Chart — CVR ao Longo do Tempo (lineChart)

| Role | Campo | Label |
|---|---|---|
| Category | `dim_calendar[Year]`, `dim_calendar[Week Number 544]` | |
| Y | `_Medidas[CVR_OH]` | CVR OH |
| Y | `_Medidas[CVR_Total]` | CVR Mkt |
| Y2 | `_Medidas[SQ Total Search Vol]` | Search Vol. |

#### Visual: Table — SQP por Search Query (tableEx)

Colunas: `dim_sq[search_query]`, SQ Score, Total Search Vol, Impr. OH, Clicks OH, CTR OH, Delta CTR, Pur. Rate OH, Pur. OH, CVR OH, Delta CVR

#### Visual: Table — SQP por Semana e Keyword (tableEx)

Colunas: `dim_calendar[Year]`, `dim_calendar[Week Number 544]`, `dim_sq[search_query]`, CVR OH, CVR Mkt, Search Vol.

#### Visual: Pivot Table — SQP por Familia e SKU (pivotTable)

| Role | Campo | Label |
|---|---|---|
| Rows | `OH ASINs[Amazon Family]`, `OH ASINs[Base SKU]` | |
| Values | `_Medidas[SQ Total Search Vol]` | Total Search Vol |
| Values | `_Medidas[IMP_OH]` | Impr. OH |
| Values | `_Medidas[CLK_OH]` | Clicks OH |
| Values | `_Medidas[CTR_OH]` | CTR OH |
| Values | `_Medidas[delta_CTR]` | Delta CTR |
| Values | `_Medidas[PUR_Rate_OH]` | Pur. Rate OH |
| Values | `_Medidas[PUR_OH]` | Pur. OH |
| Values | `_Medidas[CVR_OH]` | CVR OH |
| Values | `_Medidas[delta_CVR]` | Delta CVR |

---

### Pagina: Promotion Tracker

Calendario de promocoes planejadas por SKU/familia com visualizacao de status no tempo e grafico de evolucao de preco.

#### Slicers

`OH ASINs[Marketplace]`, `OH ASINs[Amazon Family]`, `OH ASINs[Native Family]`, `fact_promotion_tracker[Base SKU]` (listSlicer), `fact_promotion_tracker[pricePromotionAction]`, `fact_promotion_tracker[Category]`, `dim_calendar[Date]`, `z.dynamic_time_frame_switch[Time Frame]` (advancedSlicer), `z_dynamic_promo_evo[Promo]`, `z_dynamic_price_evo[Price]`

#### Visual: KPI Card — Contagem de Acoes (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[ActivePromotions]` | |
| `_Medidas[ActivePromoNextWeek]` | |
| `_Medidas[PED Count]` | |
| `_Medidas[Best Deal Count]` | |
| `_Medidas[Lightning Deal Count]` | |
| `_Medidas[Price Increase Count]` | |
| `_Medidas[Price Decrease Count]` | |

#### Visual: Pivot Table — Calendario de Promocoes (pivotTable)

| Role | Campo |
|---|---|
| Columns | `dim_calendar[Date]` |
| Rows | `fact_promotion_tracker[Title Description]`, `OH ASINs[Amazon Family]` |
| Values | `_Medidas[StatusPromocaoSKU]` |

#### Visual: Line Chart — Evolucao de Preco com Promo (lineChart)

Mesmas series do grafico MAE: OH/COMP Final Price, PED, Deal, Coupon ao longo do tempo.

---

### Pagina: Keyword Tracker

Monitoramento de palavras-chave indexadas e ranking organico (DataDive Rank Radar).

#### Slicers

`dim_marketplace[Marketplace]`, `fact_RankRadar_KWs[Search Volume]`, `fact_RankRadar_KWs[rank]`, `dim_calendar[Date]`, `fact_RankRadar_KWs[Search Terms]` (textSlicer), `z.dynamic_time_frame_switch[Time Frame]`

#### Visual: KPI Card (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[DD_Indexed_KWs]` | Indexed Keywords |
| `_Medidas[DD_%_Top10]` | % Top 10 |
| `_Medidas[DD_%_Top30]` | % Top 30 |
| `_Medidas[DD_Sum_Search_Vol]` | Total Search Volume |

#### Visual: Bar Chart — Keywords Indexadas por SKU (clusteredBarChart)

| Role | Campo |
|---|---|
| Category | `OH ASINs[Base SKU]` |
| Y | `_Medidas[DD_Indexed_KWs]` |

#### Visual: Bar Chart — Search Volume por SKU (clusteredBarChart)

| Role | Campo |
|---|---|
| Category | `OH ASINs[Base SKU]` |
| Y | `_Medidas[DD_Sum_Search_Vol]` |

#### Visual: Combo Chart — Volume e Indexacao ao Longo do Tempo (lineStackedColumnComboChart)

| Role | Campo | Label |
|---|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]`, `PARAM_AvailableDates[Date]` | |
| Y | `_Medidas[DD_Sum_Search_Vol]` | Total Search Volume |
| Y2 | `_Medidas[DD_Indexed_KWs]` | Indexed KWs |
| Y2 | `_Medidas[DD_Total_KWs]` | Total KWs |

#### Visual: Table — Detalhe por Keyword (tableEx)

Colunas: `fact_RankRadar_KWs[Search Terms]`, Rank (Median), Avg. Search Vol., Opportunity Score, Rank Volatility, Rank (Avg)

---

### Pagina: Keyword Gain/Loss

Comparativo de keywords entre dois periodos — ganhos, perdas e permanencias.

#### Slicers

`dim_marketplace[Marketplace]`, `fact_RankRadar_KWs[Search Volume]`, `fact_RankRadar_KWs[rank]`, `fact_RankRadar_KWs[Search Terms]` (textSlicer), `PARAM_AvailableDates[Date]`, `PARAM_AvailableDates_Comp[Date]`

#### Visual: KPI Card — Status de Keywords (cardVisual)

| Medida | Label |
|---|---|
| `_Medidas[KW_New]` | New KWs |
| `_Medidas[KW_Lost]` | Lost KWs |
| `_Medidas[KW_Remained]` | Remained KWs |

#### Visual: Column Chart — Rank Mediano ao Longo do Tempo (clusteredColumnChart)

| Role | Campo |
|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` |
| Y | `_Medidas[DD_Median_Rank]` |

#### Visuais: 3 Tables — Keywords (New, Lost, Remained)

Cada tabela: `fact_RankRadar_KWs[Search Terms]` + `_Medidas[Last_Search_Volume]`

---

### Pagina: Hijackers

Monitoramento de hijackers na Buy Box dos produtos OrganiHaus (merchants nao autorizados vendendo os ASINs).

#### Slicers

`OH ASINs[Amazon Family]`, `OH ASINs[ASIN]`, `dim_marketplace[Marketplace]`, `dim_calendar[Date]`

#### Visual: Line Chart — Hijackers ao Longo do Tempo (lineChart)

| Role | Campo |
|---|---|
| Category | `z.dynamic_time_frame_switch[Abbreviated Date]` |
| Series | `fact_mae[Country]` |
| Y | `_Medidas[OH_hijackers]` |

#### Visual: KPI Card — Hijackers por Pais (cardVisual)

| Role | Campo |
|---|---|
| Data | `_Medidas[OH_hijackers]` |
| Rows | `fact_mae[Country]` |

#### Visual: Bar Chart — Hijackers por Merchant (barChart)

| Role | Campo |
|---|---|
| Category | `fact_mae[Merchant]` |
| Y | `_Medidas[OH_hijackers]` |

#### Visual: Table — Detalhe de Hijackers (tableEx)

Colunas: `dim_marketplace[Marketplace]`, `OH ASINs[Amazon Family]`, `fact_mae[Merchant]`, `OH ASINs[Base SKU]`, Final Price, Link

---

### Pagina: Funnel

Visao do funil de conversao SQP — OrganiHaus vs mercado total — para o periodo selecionado. Pagina de view rapida com cards individuais para todas as taxas.

**Cards:** IMP_OH, IMP_Total, CLK_OH, CLK_Total, A2C_OH, A2C_Total, PUR_OH, PUR_Total, CTR_OH, CTR_Total, A2C_Rate_OH, A2C_Rate_Total, PUR_Rate_OH, PUR_Rate_Total, CVR_OH, CVR_Total, IMP_Share, CLK_Share, A2C_Share, PUR_Share, SQ Total Search Vol, ui_delta_CTR, ui_delta_CVR, ui_delta_A2C_Rate, ui_delta_PUR_Rate

---

### Paginas Tooltip e Ocultas

| Pagina | Tipo | Conteudo |
|---|---|---|
| `SQP Tool Tip` | Tooltip (ActualSize) | Vazio / placeholder |
| `Freq Tooltip` | Tooltip (ActualSize) | Tabela com historico de preco e promo do competidor: Date, Coupon Type, Limited Time Deal, Final Price, PED, Promotion Type |
| `Promo Tooltip` | Tooltip | Tabela de acoes de promocao planejadas: Base SKU, Native Family, actionDescription, pricePromotionAction, Objective, Current Price, Simulated Price, startDate, endDate |
| `Rank Tooltip` | Tooltip (ActualSize) | Placeholder (Market Share removido) |
| `Last Date Tooltip` | Tooltip (ActualSize) | Multi Row Card: last_update_date (Last Updated), last_date_compared (Last Price Date) |
| `Page 2` | Oculta | Line chart de evolucao de preco + table de ASINs (versao de desenvolvimento) |
| `Page 1` | Oculta | Tables de SKUs para debug/validacao |

---

## Relacionamentos

Composite Model com calendario proprio (`dim_calendar`, nao o `Calendar` do Base Tables). `SKUs` em DirectQuery ao Base Tables.

**Por que 5 relacionamentos estao desativados:** Apos a unificacao de `OH_Output` + `COMP_Output` em `fact_mae`, criaram-se caminhos ambiguos. O erro `PFE_XL_USERELATIONSHIP_AMBIGUOUS_PATH` impede o modelo de abrir. A solucao foi desativar os 5 relacionamentos que formavam triangulos/diamantes. Nenhum deles precisa de `USERELATIONSHIP()` nas medidas — o padrao REMOVEFILTERS+TREATAS ja cobre todos os casos de uso.

**Relacionamentos ativos principais:**

| De | Para | Cardinalidade |
|---|---|---|
| `fact_mae.'Key: Country \| ASIN'` | `OH ASINs.'Key Country \| ASIN'` | many-to-many |
| `fact_mae.'Key Country \| ASIN \| Brand'` | `Competitors ASINs.'Key Country \| ASIN \| Brand'` | many-to-many |
| `fact_mae.Date` | `dim_calendar.Date` | many-to-one |
| `fact_mae.Brand` | `dim_featured_brands.Brand` | many-to-one |
| `fact_mae.'Promotion Type'` | `dim_promo_type.Custom` | many-to-one |
| `fact_promotion_tracker.activeDate` | `dim_calendar.Date` | many-to-one |
| `fact_RankRadar_KWs.originalDate` | `dim_calendar.Date` | many-to-one |
| `fact_sqp_asin.start_date` | `dim_calendar.Date` | many-to-one |
| `fact_sqp_sv.start_date` | `dim_calendar.Date` | many-to-one |
| `fact_sqp_sv_funnel_totals.start_date` | `dim_calendar.Date` | many-to-one |
| `z.dynamic_time_frame_switch.'Start Date'` | `dim_calendar.Date` | bidir |
| `OH ASINs.Country` | `dim_country.Marketplace` | many-to-one |
| `OH ASINs.ASIN` | `ASIN Brand.ASIN` | many-to-one |
| `Competitors ASINs.Highlight` | `dim_important_competitors.Id` | many-to-one |
| `fact_promotion_tracker.keyCountryAsin` | `OH ASINs.'Key Country \| ASIN'` | many-to-one |
| `dim_country.Region` | `dim_marketplace.Marketplace` | many-to-one |
| `SKUs.ASIN` | `ASIN Brand.ASIN` | many-to-one |
| `fact_RankRadar_KWs.'Key Amazon Family \| Top Variation'` | `OH ASINs.'Key Amazon Family \| Top Variation'` | many-to-many |
| `fact_RankRadar_KWs.'Key Country \| Search Term'` | `aux_DD_SV.'Key Country \| Search Term'` | many-to-one |
| `fact_sqp_asin.'Key SQ'` | `dim_sq.'Key SQ'` | many-to-one |
| `fact_sqp_sv.'Key SQ'` | `dim_sq.'Key SQ'` | many-to-one |
| `fact_sqp_sv_funnel_totals.'Key SQ'` | `dim_sq.'Key SQ'` | many-to-one |
| `fact_sqp_asin.'Key Country \| ASIN'` | `OH ASINs.'Key Country \| ASIN'` | many-to-one |

**Relacionamentos inativos (desativados para evitar ambiguous path):**

| De | Para | Motivo |
|---|---|---|
| `Competitors ASINs.ASIN` | `ASIN Brand.ASIN` | Evita diamante — ASIN Brand acessivel via OH ASINs |
| `Competitors ASINs.Brand` | `dim_featured_brands.Brand` | Evita diamante — dim_featured_brands acessivel via fact_mae |
| `fact_mae.Country` | `dim_country.Marketplace` | Auto-detectado — evita 3 caminhos; filtro vai via OH ASINs |
| `Competitors ASINs.Country` | `dim_country.Marketplace` | Evita 3 caminhos; filtro vai via OH ASINs |
| `fact_RankRadar_KWs.'Key Country \| Amazon Family'` | `OH ASINs.'Key Country \| Amazon Family'` | Join alternativo por familia — inativo, usa `Top Variation` como ativo |

**Relacionamentos `joinOnDateBehavior: datePartOnly`** (automaticos do Power BI para tabelas de data):
`PARAM_AvailableDates`, `PARAM_AvailableDates_Comp`, `zz_Refresh_Control`, `fact_promotion_tracker.startDate`, `fact_promotion_tracker.endDate`, `z.dynamic_time_frame_switch.'Date order'`, `fact_mae.'Date Created'` — todos apontam para `LocalDateTable_*` geradas automaticamente.

---

## Pontos de Atencao

- **Composite Model + Gateway:** O modelo usa DirectQuery ao Base Tables via XMLA (`powerbi://...OrganiHaus Marketing Intelligence Center - MIC`). Refresh agendado via gateway no PBI Service — gateway precisa estar na maquina com Google Drive for Desktop autenticado. Fontes de arquivo usam paths literais (sem parametros dinamicos) para compatibilidade com o gateway.
- **fact_mae unifica OH e COMP:** As tabelas `OH_Output` e `COMP_Output` foram substituidas por `fact_mae` com coluna `Brand_Type`. Medidas COMP usam padrao `REMOVEFILTERS('OH ASINs') + TREATAS(_families, 'Competitors ASINs'[Key Country | Native Family])` para que slicer de OH ASINs nao anule dados de competidores.
- **BSR (Best Seller Rank):** ETL parseia texto `"#1,234 in Kitchen"` via funcao `fn_ParseBSR` gerando colunas `BSR 1 Rank` (Int64), `BSR 1 Category`, `BSR 2 Rank`, `BSR 2 Category` em `fact_mae`. 14 medidas BSR disponiveis (OH e COMP last/best/avg + comparativo).
- **SQP via CSV local:** A fonte `resultado_final.csv` esta em `code_repository\sqp_downloader\processed\`. Atualizacao manual necessaria para novos dados.
- **MAE OUTPUT_FILE.csv:** Arquivo gerado pelo scraper MAE. Deve ser atualizado regularmente; o modelo nao automatiza o scraping. `RangeStart = #date(2025, 9, 1)` filtra dados anteriores a set/2025 para otimizar o refresh.
- **Mapeamento de competidores v2 vs v3:** CA/UK/US/EU carregam tanto `MAE Competitors - Editado v2.xlsx` quanto `v3.xlsx` (inline nas expressoes). V3 removeu FR/ES/IT — intencional.
- **Market Share removido:** Tabela `fact_COMP_sales`, 29 medidas `displayFolder: MKTSHARE` e pagina "Market Share" foram removidos desta versao. Fonte era manual e desatualizada.
- **Filtro de paises:** `dim_country` filtra explicitamente para CA/DE/ES/FR/GB/IT/US — MX e BR sao excluidos do modelo.

---

**Documentacao:** Eleven Brands · OrganiHaus - Market Research · Dados & Analytics
