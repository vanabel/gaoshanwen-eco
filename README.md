# 观势 · 中国经济观察

Private economic dashboard and annual independent review following the research questions in Gao Shanwen's December 2024 speech. Eight official contextual indicators are not a reproduction of proprietary samples or models.

## Data and annual reports

- `data/archive.json`: verified official 2012–2025 annual communiqué data and the latest verified aggregate release. Each record has original source URL, publication date, period, basis and verification time.
- `src/parsers.mjs`: monthly/quarterly and annual parsers. Full-year reports use annual communiqué values, not the sum/average of monthly growth rates. Current-year partial results never receive a full-year comparison.
- `src/server.mjs`: live discovery, R2 persistence, revision history, report generation and authenticated import. The hosting manifest binds `BUCKET`. Source failure returns an explicitly marked verified archive, including for a first-ever visitor. Optional platform Cache API availability no longer determines whether a data response succeeds.
- `src/page.html` and `src/browser.js`: annual selector, consistent-basis annual comparisons, contextual discussion, Markdown downloads and print-to-PDF. A bundled verified archive renders before network requests. Local storage failure does not turn valid data into a data-source error.

A visit checks upstream at most every 30 minutes per active server instance. Manual refresh requests a new check. Data and annual records persist on the server; immutable content-named revisions retain previous observations. No unattended schedule is configured until a supported schedule is explicitly confirmed. Successful source updates or authenticated imports do not require republishing. Individual specialist releases can precede the aggregate economic report.

## Endpoints

Owner-private Site access protects all routes. Service callers obtain the supported bearer token from Sites `get_site`, using it only in the `OAI-Sites-Authorization` header to this Site. Never persist it or change Site sharing to update data.

- GET `/api/data`: data plus live/stored/archived state.
- GET `/api/reports`: annual archive plus current progress report.
- GET `/api/reports/YYYY.md`: reproducible template-based report; not AI-authored research or the speaker's own report.
- GET `/api/health`: runtime and R2 binding readiness, no secrets.
- POST `/api/refresh`: recheck official latest aggregate release and latest annual communiqué, persist successful results.
- POST `/api/update`, JSON `{ latest?, annual?: [] }`: import externally verified official records if the hosted network cannot retrieve the official source. Validates shape, official URL, year/period and finite values; rejects foreign Origin and older publications. Read back `/api/data` and `/api/reports` to verify persistence.

## Build and tests

`node scripts/compile.mjs` creates the single self-contained Worker from maintained sources and archive. `bash scripts/build.sh` compiles and packages, then `node scripts/validate-artifact.mjs` checks the Worker. `node scripts/test.mjs` covers upstream outage, first-visit availability, period boundaries, annual comparisons, export, R2 import/readback, revision storage, validation and independence from the Cache API. `node scripts/check-data.mjs` checks actual source retrieval. `node scripts/preview.mjs` serves localhost:4173.

## Research boundaries

Full speech text is linked to a third-party transcription; no speaker-approved complete manuscript has been verified. Original YouTube captions were blocked by sign-in requirements. The original company classifications and weights, provincial demographics/consumption panels, employment estimates and international bubble comparison model remain unreproduced. Annual reports distinguish original public facts, computed percentage-point differences and interpretive limitations.

Historical records preserve the original communiqué signed date instead of migrated URL dates. Missing national household or average survey unemployment values remain null with explicit reasons. Historical chart segments stop at missing values; no year-end or registered unemployment data are stitched into an annual-average series. GDP uses the communiqué publication vintage, not a later unified revision.

## Speech reconstruction (December 2024)

`data/speech.json` preserves the July 2024 classification table and all 23 statistical figures from a publicly accessible 30-page vector PDF. `scripts/extract-speech.py` calibrates PDF paths against printed axes; its input SHA-256 and source page links are retained. Digitized values are explicitly distinguished from raw Wind observations. Each figure has its method, assumptions, and unresolved inputs. Original estimates are frozen as-of the speech date.

`src/reconstruction.mjs` provides shared SVG rendering, OLS, strict fixed-company-sample aggregation and independent WDI event-window calculations. `src/speech-browser.js` supports chapter navigation, per-point inspection, CSV/JSON/SVG export, OLS sample sensitivity, employment-path and inflation-growth scenarios. A local CSV tool accepts user-supplied company data, checks same-company duplicates and changing samples, and plots aggregate shares and growth. It does not manufacture a stock index without its weights/adjustment rules.

`data/worldbank.json` is a verified WDI snapshot for NY.GDP.MKTP.KD.ZG in seven countries, with provider version and retrieval date. Live requests expand through the last complete calendar year, rather than freezing the query end in 2025. GET `/api/worldbank` rechecks the primary API, caches in R2 and falls back to a clearly marked snapshot. POST `/api/refresh` also refreshes WDI. Three explicit event-window conventions are supported; current revised public values are compared with, and never substituted for, the author's historical estimates.

GET `/api/speech` returns the frozen reconstruction. GET `/api/speech/charts/PAGE.svg` downloads a standalone labelled figure. Both remain owner-private. Run `node scripts/test-speech.mjs` for the complete figure inventory, sums, normalization, regressions, source inconsistencies, company deduplication and event-window checks.

### Evidence boundaries discovered during reconstruction

- Stock categories are now known, but the original complete security list, H-share coverage, deduplication, currency conversions, and price-index weights are not known.
- The age/consumption scatter equation on page 10 does not reproduce its plotted points. The core-CPI plot's 2023/2024 x positions are reversed relative to its footnote. These are retained and flagged rather than silently repaired.
- Page 25's printed equation is not reproduced by the recovered 2000–2021 observations; excluding 2020 also fails to reproduce it. No undocumented sample rule is asserted.
- 4709 is the sum of three annual stock gaps, not a deduplicated count of 4709 ten-thousand distinct workers. The rural chart's displayed component sum differs from its displayed total by one ten-thousand unit.
- The original China path reproduces approximately -0.18 pp using a pre-window that includes event year zero, versus approximately -0.68 pp when excluding it. Other event-level original paths are unavailable, so this is not imposed as the author's universal rule.

## 判断与年度趋势

`#judgments` 将2024年演讲拆为六条冻结判断，并收录2012—2024年中12个年份的来源条目。2013、2025及以后尚无条目的年份明确留空；选集不冒充完整演讲目录。演讲日、公开日和第三方存档刊载日分别保留。核心判断以转述呈现，标记原图页码、适用期限、条件与代理指标的局限。

趋势使用现有年度公报存档，保留原版公布值、缺项及统计口径，不将年内数据与全年连接。判断形成年度不是后验观测；2012—2023年的数据也不被称为2024年预测的验证。全国宏观代理、股市/城市房价、名义/实际GDP、CPI/核心CPI均不混同，不计算预测正确率。当前年度报告及Markdown下载共用同一观点来源集。

数据：`data/judgments.json`；API：`/api/judgments`；验证：`node scripts/test-judgments.mjs`。
