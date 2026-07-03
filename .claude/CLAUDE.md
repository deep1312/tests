# PG Insides — Project Instructions for AI

## Knowledge Graph (graphify)
This project maintains persistent knowledge graphs via graphify in each component's `graphify-out/`:
- `API/graphify-out/` — API backend architecture
- `UI/graphify-out/` — Frontend architecture
- `pg_health_collector/graphify-out/` — Collector agent architecture

### Before making changes
1. Run `/graphify query "<what I'm about to change>"` to load relevant context from the graphs
2. Read relevant design docs: `API/API_DESIGN.md`, `UI/UI_DESIGN.md`, `pg_health_collector/COLLECTOR_DESIGN.md`
3. Read the component's `IMPLEMENTATION_SUMMARY.md` or `README.md` for setup context

### After making changes
1. Record the change in `CHANGES.md` (root level) with purpose, problem, changes made
2. Run `/graphify <component-path> --update` to refresh the component's graph
3. Update design docs if architecture or patterns changed

## Project Structure
```
PG Insides/
├── API/              # FastAPI backend (Python)
│   ├── app/          # Application code
│   ├── tests/        # pytest tests
│   └── graphify-out/ # Knowledge graph
├── UI/               # React + TypeScript frontend
│   ├── src/          # Source code
│   ├── tests/        # Vitest tests
│   └── graphify-out/ # Knowledge graph
├── pg_health_collector/  # Collector agent (Python)
│   ├── app/          # Collector services
│   ├── configs/      # YAML configs
│   └── graphify-out/ # Knowledge graph
├── CHANGES.md        # Project-wide changelog
└── .claude/CLAUDE.md # This file
```

## Changelog
All changes MUST be logged in `CHANGES.md` at the project root. Each entry should include:
- Date and title
- Purpose / requirements
- Problem being solved (with evidence if applicable)
- Files modified
- Key design decisions

## graphify Periodic Updates
Run graphify update when:
- New features or components are added
- Architecture changes are made
- Design docs are created or modified
- At least once per session if changes were made

Use `--update` flag for incremental updates (faster, cheaper) and `--mode deep` for thorough extraction on new components.
