SELECT schema_name, table_name, display_name
FROM config.table_count_config
WHERE is_active = true
ORDER BY schema_name, table_name
