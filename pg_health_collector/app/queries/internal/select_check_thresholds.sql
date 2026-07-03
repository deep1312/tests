SELECT
    ct.threshold_id,
    ct.check_id,
    ct.server_id,
    ct.metric_name,
    ct.warning_value_num,
    ct.critical_value_num,
    ct.comparison_operator
FROM config.check_thresholds AS ct
WHERE ct.is_active = true
  AND ct.check_id = $1
  AND (ct.server_id = $2 OR ct.server_id IS NULL)
ORDER BY
    CASE WHEN ct.server_id IS NULL THEN 1 ELSE 0 END,
    ct.threshold_id;
