-- Create legend_config table

CREATE TABLE IF NOT EXISTS api.legend_config (
    id SERIAL PRIMARY KEY,
    page_name VARCHAR(255) NOT NULL,
    legend_name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    admin_only BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (page_name, legend_name)
);

-- Seed default values
INSERT INTO api.legend_config (page_name, legend_name, is_enabled) VALUES
('Dashboard', 'Total Server Count', true),
('Dashboard', 'Inactive Server Count', true),
('Dashboard', 'Collector Failures', true),
('Servers', 'Check Frequency', true),
('PG Check', 'Total Connections', true),
('PG Check', 'WAL Size', true),
('PG Check', 'Index Usage', true),
('PG Check', 'Table Bloat', true)
ON CONFLICT (page_name, legend_name) DO NOTHING;
