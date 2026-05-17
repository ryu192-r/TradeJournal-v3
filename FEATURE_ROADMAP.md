# Feature Roadmap

## ✅ Completed

### Core Trading
- [x] Trade CRUD (all LONG — Indian equities)
- [x] Open/Closed derived from `exit_price`
- [x] Auto-merge by `(symbol, date)` on create/import
- [x] Pyramid: add shares to open positions
- [x] Soft delete (status = `"deleted"`)
- [x] Trade detail modal (click symbol)
- [x] Status column (Open/Closed)
- [x] Inline SL edit with trailing/manual/breakeven stop history
- [x] Max Risk, P&L %, and Cap % table columns
- [x] Setup dropdown fetched from Playbook active setups
- [x] Playbook stats sync after trade mutations
- [x] Date range filter
- [x] Bulk select + bulk delete
- [x] Keyboard shortcuts (N, J/K)
- [x] Excel export

### Broker Import
- [x] Zerodha Console P&L CSV parser
- [x] Dhan tradebook CSV parser
- [x] Generic CSV parser
- [x] Import preview before commit
- [x] Merge on duplicate `(symbol, date)`
- [x] CSV template download per broker

### Dashboard
- [x] KPI cards (total PnL, win rate, avg R, etc.)
- [x] Equity curve (trade PnL + capital events)
- [x] Win/loss streaks
- [x] Monthly PnL bar chart

### Analytics
- [x] Daily PnL heatmap
- [x] Setup performance breakdown
- [x] R-multiple distribution
- [x] Drawdown chart
- [x] Day-of-week patterns
- [x] Time-of-day patterns
- [x] Holding period analysis

### Journal
- [x] Daily journal entries
- [x] Weekly stats endpoint (`GET /journal/weekly-stats`)
- [x] Weekly view with real stats (4-card grid + entries)

### AI Coach
- [x] AI Coach page (6 tabs)
- [x] 8 providers (Ollama local/cloud, OpenAI, DeepSeek, Anthropic, Google, Custom, OpenCode Zen)
- [x] Ollama native `/api/chat` format
- [x] OpenCode Zen integration (12 models, 5 free)
- [x] AI settings with provider selection
- [x] ISO 8601 datetime format for coach endpoints
- [x] Coach history tab

### Capital Management
- [x] Set/edit initial balance
- [x] Deposit / Withdraw modals
- [x] Delete capital events
- [x] Deployed vs Available capital display
- [x] Auto-reconciliation on trade mutations
- [x] Manual reconcile button with toast feedback
- [x] Dynamic tiers (TierEditor)
- [x] Reconciliation creates `adjustment` events (audit trail)

### UI/UX
- [x] Light/dark theme (CSS variables)
- [x] Fluid responsive layout (`clamp()` variables)
- [x] View-level code splitting with `React.lazy`/`Suspense`
- [x] Auto-refresh on mutation, mount, focus, and reconnect via React Query
- [x] Horizontal scroll table for mobile
- [x] Stacked pagination on mobile
- [x] Review section mobile fixes
- [x] Indian Rupee formatting (₹1.2k, ₹1.50L, ₹1.25Cr)
- [x] Price formatting with Indian commas (₹2,650.50)
- [x] Quantity formatting (integer)
- [x] PWA support (manifest + service worker)
- [x] Dashboard/Analytics page split

### Infrastructure
- [x] Docker Compose (4 services)
- [x] JWT auth with force-logout on 401
- [x] Rate limiter (toggleable)
- [x] Sentry integration (conditional)
- [x] Agent skills setup (GitHub Issues, triage labels, domain docs)

## 🔄 In Progress
- [ ] ADRs for key architectural decisions (13 done)

## 📋 Planned

### Live Trading Integration
- [ ] Dhan webhook endpoint (real-time trade sync)
- [ ] Live price fetching for open positions
- [ ] MCP server for journal automation (exploratory)
- [ ] Real-time PnL tracking on dashboard

### Quality of Life
- [ ] Trade notes / tags
- [x] Chart image attachments per trade (upload, gallery with delete, served via static files)
- [ ] Import from more brokers (Upstox, Angel One, Fyers)
- [ ] Trade replay / timeline view
- [x] Exit reason auto-detection with user override
- [x] Breakeven threshold (configurable PnL range, e.g., ±₹500, editable in Capital page)
- [x] Review stream: back navigation, re-review, bulk review mode
- [x] Daily journal structured prompts (discipline rating + breakeven context)
- [x] Coach personality customization (5 mentors with sliders in Settings)
- [x] Stop history timeline (view + record in trade detail modal)

### Analytics Enhancements
- [ ] Custom date range analytics
- [ ] Compare periods (this month vs last month)
- [ ] Max favorable/adverse excursion
- [ ] Expectancy calculator

### AI Coach Enhancements
- [ ] Proactive daily briefing notifications
- [ ] Trade-specific feedback (analyze individual trades)
- [ ] Pattern alerting (notify when pattern detected)
- [ ] Rule enforcement (warn before breaking rules)

### Capital Enhancements
- [ ] Multiple account support
- [ ] Goal tracking (target capital, timeline)
- [ ] Risk per trade calculator (% of capital)
- [ ] Drawdown alerts

### Mobile
- [ ] Native-feeling mobile gestures
- [ ] Offline trade logging
- [ ] Push notifications (PWA)

### Collaboration
- [ ] Share anonymized stats
- [ ] Mentor/coach view (read-only access)
- [ ] Export to PDF reports
