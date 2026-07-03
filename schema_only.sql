--
-- PostgreSQL database dump
--

\restrict 6VrclUxcFczC3hsT60Gm4xoflzDGZQof9eaXpQ3YQdiecEezeGtuXBVeOaWRw22

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: timescaledb; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;


--
-- Name: EXTENSION timescaledb; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION timescaledb IS 'Enables scalable inserts and complex queries for time-series data (Community Edition)';


--
-- Name: alerts; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA alerts;


ALTER SCHEMA alerts OWNER TO postgres;

--
-- Name: api; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA api;


ALTER SCHEMA api OWNER TO postgres;

--
-- Name: config; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA config;


ALTER SCHEMA config OWNER TO postgres;

--
-- Name: monitoring; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA monitoring;


ALTER SCHEMA monitoring OWNER TO postgres;

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: auto_insert_check_mappings(); Type: FUNCTION; Schema: config; Owner: postgres
--

CREATE FUNCTION config.auto_insert_check_mappings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    INSERT INTO config.server_checks_mapping
    (
        server_id,
        check_id
    )
    SELECT
        s.server_id,
        NEW.check_id
    FROM config.servers s
    WHERE NEW.is_active = true;

    RETURN NEW;

END;
$$;


ALTER FUNCTION config.auto_insert_check_mappings() OWNER TO postgres;

--
-- Name: auto_insert_server_checks(); Type: FUNCTION; Schema: config; Owner: postgres
--

CREATE FUNCTION config.auto_insert_server_checks() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    INSERT INTO config.server_checks_mapping (server_id, check_id)
    SELECT NEW.server_id, check_id
    FROM config.checks_master
    WHERE is_active = true;

    RETURN NEW;

END;
$$;


ALTER FUNCTION config.auto_insert_server_checks() OWNER TO postgres;

--
-- Name: get_table_count_history(integer, text); Type: FUNCTION; Schema: monitoring; Owner: postgres
--

CREATE FUNCTION monitoring.get_table_count_history(p_server_id integer, p_table_name text) RETURNS TABLE(collected_at timestamp with time zone, record_count bigint, status text)
    LANGUAGE sql
    AS $$
SELECT
    ml.collected_at,
    (r.value->>'record_count')::BIGINT,
    r.value->>'status'
FROM monitoring.monitoring_logs ml
CROSS JOIN LATERAL jsonb_array_elements(
    ml.raw_result->'rows'
) r(value)
WHERE ml.server_id = p_server_id
  AND r.value->>'table_name' = p_table_name
ORDER BY ml.collected_at DESC;
$$;


ALTER FUNCTION monitoring.get_table_count_history(p_server_id integer, p_table_name text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: check_runs; Type: TABLE; Schema: monitoring; Owner: postgres
--

CREATE TABLE monitoring.check_runs (
    run_id bigint NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    server_id integer,
    check_id integer,
    status smallint,
    execution_time_ms integer,
    error_message text,
    scheduled_at timestamp with time zone,
    cycle_started_at timestamp with time zone
);


ALTER TABLE monitoring.check_runs OWNER TO postgres;

--
-- Name: COLUMN check_runs.status; Type: COMMENT; Schema: monitoring; Owner: postgres
--

COMMENT ON COLUMN monitoring.check_runs.status IS '1=SUCCESS, 2=FAILED, 3=TIMEOUT, 4=IN_PROGRESS';


--
-- Name: COLUMN check_runs.scheduled_at; Type: COMMENT; Schema: monitoring; Owner: postgres
--

COMMENT ON COLUMN monitoring.check_runs.scheduled_at IS 'Intended start time from scheduler; NULL = unscheduled/catch-up';


--
-- Name: COLUMN check_runs.cycle_started_at; Type: COMMENT; Schema: monitoring; Owner: postgres
--

COMMENT ON COLUMN monitoring.check_runs.cycle_started_at IS 'Cycle boundary time when this check was scheduled (e.g. :00 or :30 trigger time).';


--
-- Name: _hyper_2_131_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_2_131_chunk (
    CONSTRAINT constraint_131 CHECK (((started_at >= '2026-06-30 05:30:00+05:30'::timestamp with time zone) AND (started_at < '2026-07-01 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.check_runs);


ALTER TABLE _timescaledb_internal._hyper_2_131_chunk OWNER TO postgres;

--
-- Name: _hyper_2_135_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_2_135_chunk (
    CONSTRAINT constraint_135 CHECK (((started_at >= '2026-07-01 05:30:00+05:30'::timestamp with time zone) AND (started_at < '2026-07-02 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.check_runs);


ALTER TABLE _timescaledb_internal._hyper_2_135_chunk OWNER TO postgres;

--
-- Name: _hyper_2_139_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_2_139_chunk (
    CONSTRAINT constraint_139 CHECK (((started_at >= '2026-07-02 05:30:00+05:30'::timestamp with time zone) AND (started_at < '2026-07-03 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.check_runs);


ALTER TABLE _timescaledb_internal._hyper_2_139_chunk OWNER TO postgres;

--
-- Name: _hyper_2_143_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_2_143_chunk (
    CONSTRAINT constraint_143 CHECK (((started_at >= '2026-07-03 05:30:00+05:30'::timestamp with time zone) AND (started_at < '2026-07-04 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.check_runs);


ALTER TABLE _timescaledb_internal._hyper_2_143_chunk OWNER TO postgres;

--
-- Name: monitoring_logs; Type: TABLE; Schema: monitoring; Owner: postgres
--

CREATE TABLE monitoring.monitoring_logs (
    log_id bigint NOT NULL,
    collected_at timestamp with time zone DEFAULT now() NOT NULL,
    server_id integer,
    check_id integer,
    raw_result jsonb NOT NULL,
    status_code smallint NOT NULL,
    execution_time_ms integer
);


ALTER TABLE monitoring.monitoring_logs OWNER TO postgres;

--
-- Name: COLUMN monitoring_logs.status_code; Type: COMMENT; Schema: monitoring; Owner: postgres
--

COMMENT ON COLUMN monitoring.monitoring_logs.status_code IS '1=WARNING, 2=CRITICAL, 3=FAILURE';


--
-- Name: _hyper_3_132_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_3_132_chunk (
    CONSTRAINT constraint_132 CHECK (((collected_at >= '2026-06-30 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-01 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_logs);


ALTER TABLE _timescaledb_internal._hyper_3_132_chunk OWNER TO postgres;

--
-- Name: _hyper_3_136_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_3_136_chunk (
    CONSTRAINT constraint_136 CHECK (((collected_at >= '2026-07-01 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-02 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_logs);


ALTER TABLE _timescaledb_internal._hyper_3_136_chunk OWNER TO postgres;

--
-- Name: _hyper_3_140_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_3_140_chunk (
    CONSTRAINT constraint_140 CHECK (((collected_at >= '2026-07-02 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-03 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_logs);


ALTER TABLE _timescaledb_internal._hyper_3_140_chunk OWNER TO postgres;

--
-- Name: _hyper_3_144_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_3_144_chunk (
    CONSTRAINT constraint_144 CHECK (((collected_at >= '2026-07-03 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-04 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_logs);


ALTER TABLE _timescaledb_internal._hyper_3_144_chunk OWNER TO postgres;

--
-- Name: monitoring_metrics; Type: TABLE; Schema: monitoring; Owner: postgres
--

CREATE TABLE monitoring.monitoring_metrics (
    metric_id bigint NOT NULL,
    collected_at timestamp with time zone DEFAULT now() NOT NULL,
    server_id integer,
    check_id integer,
    metric_name text NOT NULL,
    metric_value double precision,
    labels jsonb
);


ALTER TABLE monitoring.monitoring_metrics OWNER TO postgres;

--
-- Name: _hyper_4_133_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_4_133_chunk (
    CONSTRAINT constraint_133 CHECK (((collected_at >= '2026-06-30 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-01 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_metrics);


ALTER TABLE _timescaledb_internal._hyper_4_133_chunk OWNER TO postgres;

--
-- Name: _hyper_4_137_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_4_137_chunk (
    CONSTRAINT constraint_137 CHECK (((collected_at >= '2026-07-01 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-02 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_metrics);


ALTER TABLE _timescaledb_internal._hyper_4_137_chunk OWNER TO postgres;

--
-- Name: _hyper_4_141_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_4_141_chunk (
    CONSTRAINT constraint_141 CHECK (((collected_at >= '2026-07-02 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-03 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_metrics);


ALTER TABLE _timescaledb_internal._hyper_4_141_chunk OWNER TO postgres;

--
-- Name: _hyper_4_145_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_4_145_chunk (
    CONSTRAINT constraint_145 CHECK (((collected_at >= '2026-07-03 05:30:00+05:30'::timestamp with time zone) AND (collected_at < '2026-07-04 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (monitoring.monitoring_metrics);


ALTER TABLE _timescaledb_internal._hyper_4_145_chunk OWNER TO postgres;

--
-- Name: alerts; Type: TABLE; Schema: alerts; Owner: postgres
--

CREATE TABLE alerts.alerts (
    alert_id bigint NOT NULL,
    incident_id bigint,
    server_id integer NOT NULL,
    check_id integer NOT NULL,
    metric_name text NOT NULL,
    observed_value text,
    status smallint NOT NULL,
    triggered_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged_at timestamp with time zone
);


ALTER TABLE alerts.alerts OWNER TO postgres;

--
-- Name: COLUMN alerts.status; Type: COMMENT; Schema: alerts; Owner: postgres
--

COMMENT ON COLUMN alerts.alerts.status IS '1=WARNING, 2=CRITICAL';


--
-- Name: _hyper_6_138_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_6_138_chunk (
    CONSTRAINT constraint_138 CHECK (((triggered_at >= '2026-07-01 05:30:00+05:30'::timestamp with time zone) AND (triggered_at < '2026-07-02 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (alerts.alerts);


ALTER TABLE _timescaledb_internal._hyper_6_138_chunk OWNER TO postgres;

--
-- Name: _hyper_6_142_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_6_142_chunk (
    CONSTRAINT constraint_142 CHECK (((triggered_at >= '2026-07-02 05:30:00+05:30'::timestamp with time zone) AND (triggered_at < '2026-07-03 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (alerts.alerts);


ALTER TABLE _timescaledb_internal._hyper_6_142_chunk OWNER TO postgres;

--
-- Name: _hyper_6_146_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: postgres
--

CREATE TABLE _timescaledb_internal._hyper_6_146_chunk (
    CONSTRAINT constraint_146 CHECK (((triggered_at >= '2026-07-03 05:30:00+05:30'::timestamp with time zone) AND (triggered_at < '2026-07-04 05:30:00+05:30'::timestamp with time zone)))
)
INHERITS (alerts.alerts);


ALTER TABLE _timescaledb_internal._hyper_6_146_chunk OWNER TO postgres;

--
-- Name: alerts_alert_id_seq; Type: SEQUENCE; Schema: alerts; Owner: postgres
--

CREATE SEQUENCE alerts.alerts_alert_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE alerts.alerts_alert_id_seq OWNER TO postgres;

--
-- Name: alerts_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: alerts; Owner: postgres
--

ALTER SEQUENCE alerts.alerts_alert_id_seq OWNED BY alerts.alerts.alert_id;


--
-- Name: incidents; Type: TABLE; Schema: alerts; Owner: postgres
--

CREATE TABLE alerts.incidents (
    incident_id bigint NOT NULL,
    server_id integer NOT NULL,
    check_id integer NOT NULL,
    status smallint,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    root_cause text
);


ALTER TABLE alerts.incidents OWNER TO postgres;

--
-- Name: COLUMN incidents.status; Type: COMMENT; Schema: alerts; Owner: postgres
--

COMMENT ON COLUMN alerts.incidents.status IS '1=OPEN, 2=RESOLVED';


--
-- Name: incidents_incident_id_seq; Type: SEQUENCE; Schema: alerts; Owner: postgres
--

CREATE SEQUENCE alerts.incidents_incident_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE alerts.incidents_incident_id_seq OWNER TO postgres;

--
-- Name: incidents_incident_id_seq; Type: SEQUENCE OWNED BY; Schema: alerts; Owner: postgres
--

ALTER SEQUENCE alerts.incidents_incident_id_seq OWNED BY alerts.incidents.incident_id;


--
-- Name: audit_log; Type: TABLE; Schema: api; Owner: postgres
--

CREATE TABLE api.audit_log (
    log_id bigint NOT NULL,
    user_id text NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'DELETE'::text, 'CREDENTIAL_ROTATION'::text])))
);


ALTER TABLE api.audit_log OWNER TO postgres;

--
-- Name: audit_log_log_id_seq; Type: SEQUENCE; Schema: api; Owner: postgres
--

CREATE SEQUENCE api.audit_log_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE api.audit_log_log_id_seq OWNER TO postgres;

--
-- Name: audit_log_log_id_seq; Type: SEQUENCE OWNED BY; Schema: api; Owner: postgres
--

ALTER SEQUENCE api.audit_log_log_id_seq OWNED BY api.audit_log.log_id;


--
-- Name: users; Type: TABLE; Schema: api; Owner: postgres
--

CREATE TABLE api.users (
    user_id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'viewer'::text])))
);


ALTER TABLE api.users OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: api; Owner: postgres
--

CREATE SEQUENCE api.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE api.users_user_id_seq OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: api; Owner: postgres
--

ALTER SEQUENCE api.users_user_id_seq OWNED BY api.users.user_id;


--
-- Name: check_thresholds; Type: TABLE; Schema: config; Owner: postgres
--

CREATE TABLE config.check_thresholds (
    threshold_id integer NOT NULL,
    check_id integer NOT NULL,
    server_id integer,
    metric_name text NOT NULL,
    warning_value_num double precision,
    critical_value_num double precision,
    comparison_operator character varying(5),
    is_active boolean DEFAULT true,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    threshold_value double precision,
    CONSTRAINT check_thresholds_comparison_operator_check CHECK (((comparison_operator)::text = ANY ((ARRAY['>'::character varying, '<'::character varying, '='::character varying, '!='::character varying, '~'::character varying])::text[])))
);


ALTER TABLE config.check_thresholds OWNER TO postgres;

--
-- Name: check_thresholds_threshold_id_seq; Type: SEQUENCE; Schema: config; Owner: postgres
--

CREATE SEQUENCE config.check_thresholds_threshold_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE config.check_thresholds_threshold_id_seq OWNER TO postgres;

--
-- Name: check_thresholds_threshold_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.check_thresholds_threshold_id_seq OWNED BY config.check_thresholds.threshold_id;


--
-- Name: checks_master; Type: TABLE; Schema: config; Owner: postgres
--

CREATE TABLE config.checks_master (
    check_id integer NOT NULL,
    check_code character varying(20) NOT NULL,
    category character varying(5) NOT NULL,
    check_name text NOT NULL,
    query_text text NOT NULL,
    timeout_ms integer,
    default_frequency_sec integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text DEFAULT 'system'::text,
    is_active boolean DEFAULT true,
    version integer DEFAULT 1 NOT NULL
);


ALTER TABLE config.checks_master OWNER TO postgres;

--
-- Name: checks_master_check_id_seq; Type: SEQUENCE; Schema: config; Owner: postgres
--

CREATE SEQUENCE config.checks_master_check_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE config.checks_master_check_id_seq OWNER TO postgres;

--
-- Name: checks_master_check_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.checks_master_check_id_seq OWNED BY config.checks_master.check_id;


--
-- Name: server_checks_mapping; Type: TABLE; Schema: config; Owner: postgres
--

CREATE TABLE config.server_checks_mapping (
    mapping_id integer NOT NULL,
    server_id integer NOT NULL,
    check_id integer NOT NULL,
    custom_frequency_sec integer,
    is_enabled boolean DEFAULT true,
    consecutive_failures integer DEFAULT 0 NOT NULL,
    backoff_until timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE config.server_checks_mapping OWNER TO postgres;

--
-- Name: COLUMN server_checks_mapping.consecutive_failures; Type: COMMENT; Schema: config; Owner: postgres
--

COMMENT ON COLUMN config.server_checks_mapping.consecutive_failures IS 'Incremented on each failed run, reset on success. Used for circuit breaker.';


--
-- Name: COLUMN server_checks_mapping.backoff_until; Type: COMMENT; Schema: config; Owner: postgres
--

COMMENT ON COLUMN config.server_checks_mapping.backoff_until IS 'Collector skips this mapping until this timestamp. NULL = no backoff active.';


--
-- Name: server_checks_mapping_mapping_id_seq; Type: SEQUENCE; Schema: config; Owner: postgres
--

CREATE SEQUENCE config.server_checks_mapping_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE config.server_checks_mapping_mapping_id_seq OWNER TO postgres;

--
-- Name: server_checks_mapping_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.server_checks_mapping_mapping_id_seq OWNED BY config.server_checks_mapping.mapping_id;


--
-- Name: servers; Type: TABLE; Schema: config; Owner: postgres
--

CREATE TABLE config.servers (
    server_id integer NOT NULL,
    server_label text NOT NULL,
    server_ip text NOT NULL,
    port integer DEFAULT 5432,
    db_name text NOT NULL,
    username text NOT NULL,
    password_encrypted text NOT NULL,
    server_role character varying(20),
    env_type character varying(20),
    ssl_mode character varying(20),
    retention_metrics_days integer DEFAULT 365,
    retention_logs_days integer DEFAULT 30,
    retention_runs_days integer DEFAULT 7,
    compression_days integer DEFAULT 7,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_by text,
    version integer DEFAULT 1 NOT NULL,
    tags jsonb,
    is_active boolean DEFAULT true,
    last_heartbeat timestamp with time zone,
    is_di_server boolean DEFAULT false,
    CONSTRAINT valid_retention_period CHECK ((retention_metrics_days >= retention_logs_days))
);


ALTER TABLE config.servers OWNER TO postgres;

--
-- Name: servers_server_id_seq; Type: SEQUENCE; Schema: config; Owner: postgres
--

CREATE SEQUENCE config.servers_server_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE config.servers_server_id_seq OWNER TO postgres;

--
-- Name: servers_server_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.servers_server_id_seq OWNED BY config.servers.server_id;


--
-- Name: table_count_config; Type: TABLE; Schema: config; Owner: postgres
--

CREATE TABLE config.table_count_config (
    id bigint NOT NULL,
    schema_name character varying(100) NOT NULL,
    table_name character varying(100) NOT NULL,
    display_name character varying(200),
    is_active boolean DEFAULT true NOT NULL,
    created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE config.table_count_config OWNER TO postgres;

--
-- Name: table_count_config_id_seq; Type: SEQUENCE; Schema: config; Owner: postgres
--

CREATE SEQUENCE config.table_count_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE config.table_count_config_id_seq OWNER TO postgres;

--
-- Name: table_count_config_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.table_count_config_id_seq OWNED BY config.table_count_config.id;


--
-- Name: check_runs_run_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: postgres
--

CREATE SEQUENCE monitoring.check_runs_run_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE monitoring.check_runs_run_id_seq OWNER TO postgres;

--
-- Name: check_runs_run_id_seq; Type: SEQUENCE OWNED BY; Schema: monitoring; Owner: postgres
--

ALTER SEQUENCE monitoring.check_runs_run_id_seq OWNED BY monitoring.check_runs.run_id;


--
-- Name: monitoring_logs_log_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: postgres
--

CREATE SEQUENCE monitoring.monitoring_logs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE monitoring.monitoring_logs_log_id_seq OWNER TO postgres;

--
-- Name: monitoring_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: monitoring; Owner: postgres
--

ALTER SEQUENCE monitoring.monitoring_logs_log_id_seq OWNED BY monitoring.monitoring_logs.log_id;


--
-- Name: monitoring_metrics_metric_id_seq; Type: SEQUENCE; Schema: monitoring; Owner: postgres
--

CREATE SEQUENCE monitoring.monitoring_metrics_metric_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE monitoring.monitoring_metrics_metric_id_seq OWNER TO postgres;

--
-- Name: monitoring_metrics_metric_id_seq; Type: SEQUENCE OWNED BY; Schema: monitoring; Owner: postgres
--

ALTER SEQUENCE monitoring.monitoring_metrics_metric_id_seq OWNED BY monitoring.monitoring_metrics.metric_id;


--
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    server_id integer NOT NULL,
    server_label character varying,
    server_ip character varying,
    port character varying,
    db_name character varying,
    username character varying,
    password character varying,
    server_role character varying,
    env_type character varying,
    ssl_mode character varying,
    retention_metrics_days integer,
    retention_logs_days integer,
    retention_runs_days integer,
    compression_days integer,
    tags character varying,
    version character varying,
    is_active boolean,
    created_at timestamp without time zone
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- Name: servers_server_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servers_server_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servers_server_id_seq OWNER TO postgres;

--
-- Name: servers_server_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servers_server_id_seq OWNED BY public.servers.server_id;


--
-- Name: _hyper_2_131_chunk run_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_131_chunk ALTER COLUMN run_id SET DEFAULT nextval('monitoring.check_runs_run_id_seq'::regclass);


--
-- Name: _hyper_2_131_chunk started_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_131_chunk ALTER COLUMN started_at SET DEFAULT now();


--
-- Name: _hyper_2_135_chunk run_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_135_chunk ALTER COLUMN run_id SET DEFAULT nextval('monitoring.check_runs_run_id_seq'::regclass);


--
-- Name: _hyper_2_135_chunk started_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_135_chunk ALTER COLUMN started_at SET DEFAULT now();


--
-- Name: _hyper_2_139_chunk run_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_139_chunk ALTER COLUMN run_id SET DEFAULT nextval('monitoring.check_runs_run_id_seq'::regclass);


--
-- Name: _hyper_2_139_chunk started_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_139_chunk ALTER COLUMN started_at SET DEFAULT now();


--
-- Name: _hyper_2_143_chunk run_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_143_chunk ALTER COLUMN run_id SET DEFAULT nextval('monitoring.check_runs_run_id_seq'::regclass);


--
-- Name: _hyper_2_143_chunk started_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_143_chunk ALTER COLUMN started_at SET DEFAULT now();


--
-- Name: _hyper_3_132_chunk log_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_132_chunk ALTER COLUMN log_id SET DEFAULT nextval('monitoring.monitoring_logs_log_id_seq'::regclass);


--
-- Name: _hyper_3_132_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_132_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_3_136_chunk log_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_136_chunk ALTER COLUMN log_id SET DEFAULT nextval('monitoring.monitoring_logs_log_id_seq'::regclass);


--
-- Name: _hyper_3_136_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_136_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_3_140_chunk log_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_140_chunk ALTER COLUMN log_id SET DEFAULT nextval('monitoring.monitoring_logs_log_id_seq'::regclass);


--
-- Name: _hyper_3_140_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_140_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_3_144_chunk log_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_144_chunk ALTER COLUMN log_id SET DEFAULT nextval('monitoring.monitoring_logs_log_id_seq'::regclass);


--
-- Name: _hyper_3_144_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_144_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_4_133_chunk metric_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_133_chunk ALTER COLUMN metric_id SET DEFAULT nextval('monitoring.monitoring_metrics_metric_id_seq'::regclass);


--
-- Name: _hyper_4_133_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_133_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_4_137_chunk metric_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_137_chunk ALTER COLUMN metric_id SET DEFAULT nextval('monitoring.monitoring_metrics_metric_id_seq'::regclass);


--
-- Name: _hyper_4_137_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_137_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_4_141_chunk metric_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_141_chunk ALTER COLUMN metric_id SET DEFAULT nextval('monitoring.monitoring_metrics_metric_id_seq'::regclass);


--
-- Name: _hyper_4_141_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_141_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_4_145_chunk metric_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_145_chunk ALTER COLUMN metric_id SET DEFAULT nextval('monitoring.monitoring_metrics_metric_id_seq'::regclass);


--
-- Name: _hyper_4_145_chunk collected_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_145_chunk ALTER COLUMN collected_at SET DEFAULT now();


--
-- Name: _hyper_6_138_chunk alert_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_138_chunk ALTER COLUMN alert_id SET DEFAULT nextval('alerts.alerts_alert_id_seq'::regclass);


--
-- Name: _hyper_6_138_chunk triggered_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_138_chunk ALTER COLUMN triggered_at SET DEFAULT now();


--
-- Name: _hyper_6_142_chunk alert_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_142_chunk ALTER COLUMN alert_id SET DEFAULT nextval('alerts.alerts_alert_id_seq'::regclass);


--
-- Name: _hyper_6_142_chunk triggered_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_142_chunk ALTER COLUMN triggered_at SET DEFAULT now();


--
-- Name: _hyper_6_146_chunk alert_id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_146_chunk ALTER COLUMN alert_id SET DEFAULT nextval('alerts.alerts_alert_id_seq'::regclass);


--
-- Name: _hyper_6_146_chunk triggered_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_146_chunk ALTER COLUMN triggered_at SET DEFAULT now();


--
-- Name: alerts alert_id; Type: DEFAULT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts ALTER COLUMN alert_id SET DEFAULT nextval('alerts.alerts_alert_id_seq'::regclass);


--
-- Name: incidents incident_id; Type: DEFAULT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents ALTER COLUMN incident_id SET DEFAULT nextval('alerts.incidents_incident_id_seq'::regclass);


--
-- Name: audit_log log_id; Type: DEFAULT; Schema: api; Owner: postgres
--

ALTER TABLE ONLY api.audit_log ALTER COLUMN log_id SET DEFAULT nextval('api.audit_log_log_id_seq'::regclass);


--
-- Name: users user_id; Type: DEFAULT; Schema: api; Owner: postgres
--

ALTER TABLE ONLY api.users ALTER COLUMN user_id SET DEFAULT nextval('api.users_user_id_seq'::regclass);


--
-- Name: check_thresholds threshold_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds ALTER COLUMN threshold_id SET DEFAULT nextval('config.check_thresholds_threshold_id_seq'::regclass);


--
-- Name: checks_master check_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.checks_master ALTER COLUMN check_id SET DEFAULT nextval('config.checks_master_check_id_seq'::regclass);


--
-- Name: server_checks_mapping mapping_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping ALTER COLUMN mapping_id SET DEFAULT nextval('config.server_checks_mapping_mapping_id_seq'::regclass);


--
-- Name: servers server_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.servers ALTER COLUMN server_id SET DEFAULT nextval('config.servers_server_id_seq'::regclass);


--
-- Name: table_count_config id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.table_count_config ALTER COLUMN id SET DEFAULT nextval('config.table_count_config_id_seq'::regclass);


--
-- Name: check_runs run_id; Type: DEFAULT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs ALTER COLUMN run_id SET DEFAULT nextval('monitoring.check_runs_run_id_seq'::regclass);


--
-- Name: monitoring_logs log_id; Type: DEFAULT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs ALTER COLUMN log_id SET DEFAULT nextval('monitoring.monitoring_logs_log_id_seq'::regclass);


--
-- Name: monitoring_metrics metric_id; Type: DEFAULT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics ALTER COLUMN metric_id SET DEFAULT nextval('monitoring.monitoring_metrics_metric_id_seq'::regclass);


--
-- Name: servers server_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers ALTER COLUMN server_id SET DEFAULT nextval('public.servers_server_id_seq'::regclass);


--
-- Name: _hyper_2_131_chunk 131_410_check_runs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_131_chunk
    ADD CONSTRAINT "131_410_check_runs_pkey" PRIMARY KEY (run_id, started_at);


--
-- Name: _hyper_3_132_chunk 132_413_monitoring_logs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_132_chunk
    ADD CONSTRAINT "132_413_monitoring_logs_pkey" PRIMARY KEY (log_id, collected_at);


--
-- Name: _hyper_4_133_chunk 133_416_monitoring_metrics_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_133_chunk
    ADD CONSTRAINT "133_416_monitoring_metrics_pkey" PRIMARY KEY (metric_id, collected_at);


--
-- Name: _hyper_2_135_chunk 135_423_check_runs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_135_chunk
    ADD CONSTRAINT "135_423_check_runs_pkey" PRIMARY KEY (run_id, started_at);


--
-- Name: _hyper_3_136_chunk 136_426_monitoring_logs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_136_chunk
    ADD CONSTRAINT "136_426_monitoring_logs_pkey" PRIMARY KEY (log_id, collected_at);


--
-- Name: _hyper_4_137_chunk 137_429_monitoring_metrics_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_137_chunk
    ADD CONSTRAINT "137_429_monitoring_metrics_pkey" PRIMARY KEY (metric_id, collected_at);


--
-- Name: _hyper_6_138_chunk 138_433_alerts_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_138_chunk
    ADD CONSTRAINT "138_433_alerts_pkey" PRIMARY KEY (alert_id, triggered_at);


--
-- Name: _hyper_2_139_chunk 139_436_check_runs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_139_chunk
    ADD CONSTRAINT "139_436_check_runs_pkey" PRIMARY KEY (run_id, started_at);


--
-- Name: _hyper_3_140_chunk 140_439_monitoring_logs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_140_chunk
    ADD CONSTRAINT "140_439_monitoring_logs_pkey" PRIMARY KEY (log_id, collected_at);


--
-- Name: _hyper_4_141_chunk 141_442_monitoring_metrics_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_141_chunk
    ADD CONSTRAINT "141_442_monitoring_metrics_pkey" PRIMARY KEY (metric_id, collected_at);


--
-- Name: _hyper_6_142_chunk 142_446_alerts_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_142_chunk
    ADD CONSTRAINT "142_446_alerts_pkey" PRIMARY KEY (alert_id, triggered_at);


--
-- Name: _hyper_2_143_chunk 143_449_check_runs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_143_chunk
    ADD CONSTRAINT "143_449_check_runs_pkey" PRIMARY KEY (run_id, started_at);


--
-- Name: _hyper_3_144_chunk 144_452_monitoring_logs_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_144_chunk
    ADD CONSTRAINT "144_452_monitoring_logs_pkey" PRIMARY KEY (log_id, collected_at);


--
-- Name: _hyper_4_145_chunk 145_455_monitoring_metrics_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_145_chunk
    ADD CONSTRAINT "145_455_monitoring_metrics_pkey" PRIMARY KEY (metric_id, collected_at);


--
-- Name: _hyper_6_146_chunk 146_459_alerts_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_146_chunk
    ADD CONSTRAINT "146_459_alerts_pkey" PRIMARY KEY (alert_id, triggered_at);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (alert_id, triggered_at);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (incident_id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: api; Owner: postgres
--

ALTER TABLE ONLY api.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (log_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: api; Owner: postgres
--

ALTER TABLE ONLY api.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: api; Owner: postgres
--

ALTER TABLE ONLY api.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: check_thresholds check_thresholds_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds
    ADD CONSTRAINT check_thresholds_pkey PRIMARY KEY (threshold_id);


--
-- Name: checks_master checks_master_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.checks_master
    ADD CONSTRAINT checks_master_pkey PRIMARY KEY (check_id);


--
-- Name: server_checks_mapping server_checks_mapping_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_pkey PRIMARY KEY (mapping_id);


--
-- Name: server_checks_mapping server_checks_mapping_server_id_check_id_key; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_server_id_check_id_key UNIQUE (server_id, check_id);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (server_id);


--
-- Name: servers servers_server_label_key; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.servers
    ADD CONSTRAINT servers_server_label_key UNIQUE (server_label);


--
-- Name: table_count_config table_count_config_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.table_count_config
    ADD CONSTRAINT table_count_config_pkey PRIMARY KEY (id);


--
-- Name: table_count_config uq_table_count_config; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.table_count_config
    ADD CONSTRAINT uq_table_count_config UNIQUE (schema_name, table_name);


--
-- Name: check_runs check_runs_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs
    ADD CONSTRAINT check_runs_pkey PRIMARY KEY (run_id, started_at);


--
-- Name: monitoring_logs monitoring_logs_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs
    ADD CONSTRAINT monitoring_logs_pkey PRIMARY KEY (log_id, collected_at);


--
-- Name: monitoring_metrics monitoring_metrics_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics
    ADD CONSTRAINT monitoring_metrics_pkey PRIMARY KEY (metric_id, collected_at);


--
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (server_id);


--
-- Name: _hyper_2_131_chunk_check_runs_started_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_2_131_chunk_check_runs_started_at_idx ON _timescaledb_internal._hyper_2_131_chunk USING btree (started_at DESC);


--
-- Name: _hyper_2_131_chunk_uq_check_runs_server_check_scheduled; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE UNIQUE INDEX _hyper_2_131_chunk_uq_check_runs_server_check_scheduled ON _timescaledb_internal._hyper_2_131_chunk USING btree (server_id, check_id, scheduled_at, started_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: _hyper_2_135_chunk_check_runs_started_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_2_135_chunk_check_runs_started_at_idx ON _timescaledb_internal._hyper_2_135_chunk USING btree (started_at DESC);


--
-- Name: _hyper_2_135_chunk_uq_check_runs_server_check_scheduled; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE UNIQUE INDEX _hyper_2_135_chunk_uq_check_runs_server_check_scheduled ON _timescaledb_internal._hyper_2_135_chunk USING btree (server_id, check_id, scheduled_at, started_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: _hyper_2_139_chunk_check_runs_started_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_2_139_chunk_check_runs_started_at_idx ON _timescaledb_internal._hyper_2_139_chunk USING btree (started_at DESC);


--
-- Name: _hyper_2_139_chunk_uq_check_runs_server_check_scheduled; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE UNIQUE INDEX _hyper_2_139_chunk_uq_check_runs_server_check_scheduled ON _timescaledb_internal._hyper_2_139_chunk USING btree (server_id, check_id, scheduled_at, started_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: _hyper_2_143_chunk_check_runs_started_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_2_143_chunk_check_runs_started_at_idx ON _timescaledb_internal._hyper_2_143_chunk USING btree (started_at DESC);


--
-- Name: _hyper_2_143_chunk_uq_check_runs_server_check_scheduled; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE UNIQUE INDEX _hyper_2_143_chunk_uq_check_runs_server_check_scheduled ON _timescaledb_internal._hyper_2_143_chunk USING btree (server_id, check_id, scheduled_at, started_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: _hyper_3_132_chunk_monitoring_logs_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_3_132_chunk_monitoring_logs_collected_at_idx ON _timescaledb_internal._hyper_3_132_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_3_136_chunk_monitoring_logs_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_3_136_chunk_monitoring_logs_collected_at_idx ON _timescaledb_internal._hyper_3_136_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_3_140_chunk_monitoring_logs_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_3_140_chunk_monitoring_logs_collected_at_idx ON _timescaledb_internal._hyper_3_140_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_3_144_chunk_monitoring_logs_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_3_144_chunk_monitoring_logs_collected_at_idx ON _timescaledb_internal._hyper_3_144_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_4_133_chunk_idx_metrics_ui_fast; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_133_chunk_idx_metrics_ui_fast ON _timescaledb_internal._hyper_4_133_chunk USING btree (server_id, metric_name, collected_at DESC);


--
-- Name: _hyper_4_133_chunk_monitoring_metrics_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_133_chunk_monitoring_metrics_collected_at_idx ON _timescaledb_internal._hyper_4_133_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_4_137_chunk_idx_metrics_ui_fast; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_137_chunk_idx_metrics_ui_fast ON _timescaledb_internal._hyper_4_137_chunk USING btree (server_id, metric_name, collected_at DESC);


--
-- Name: _hyper_4_137_chunk_monitoring_metrics_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_137_chunk_monitoring_metrics_collected_at_idx ON _timescaledb_internal._hyper_4_137_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_4_141_chunk_idx_metrics_ui_fast; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_141_chunk_idx_metrics_ui_fast ON _timescaledb_internal._hyper_4_141_chunk USING btree (server_id, metric_name, collected_at DESC);


--
-- Name: _hyper_4_141_chunk_monitoring_metrics_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_141_chunk_monitoring_metrics_collected_at_idx ON _timescaledb_internal._hyper_4_141_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_4_145_chunk_idx_metrics_ui_fast; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_145_chunk_idx_metrics_ui_fast ON _timescaledb_internal._hyper_4_145_chunk USING btree (server_id, metric_name, collected_at DESC);


--
-- Name: _hyper_4_145_chunk_monitoring_metrics_collected_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_4_145_chunk_monitoring_metrics_collected_at_idx ON _timescaledb_internal._hyper_4_145_chunk USING btree (collected_at DESC);


--
-- Name: _hyper_6_138_chunk_alerts_triggered_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_6_138_chunk_alerts_triggered_at_idx ON _timescaledb_internal._hyper_6_138_chunk USING btree (triggered_at DESC);


--
-- Name: _hyper_6_142_chunk_alerts_triggered_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_6_142_chunk_alerts_triggered_at_idx ON _timescaledb_internal._hyper_6_142_chunk USING btree (triggered_at DESC);


--
-- Name: _hyper_6_146_chunk_alerts_triggered_at_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: postgres
--

CREATE INDEX _hyper_6_146_chunk_alerts_triggered_at_idx ON _timescaledb_internal._hyper_6_146_chunk USING btree (triggered_at DESC);


--
-- Name: alerts_triggered_at_idx; Type: INDEX; Schema: alerts; Owner: postgres
--

CREATE INDEX alerts_triggered_at_idx ON alerts.alerts USING btree (triggered_at DESC);


--
-- Name: idx_audit_log_changed_at; Type: INDEX; Schema: api; Owner: postgres
--

CREATE INDEX idx_audit_log_changed_at ON api.audit_log USING btree (changed_at DESC);


--
-- Name: idx_audit_log_resource; Type: INDEX; Schema: api; Owner: postgres
--

CREATE INDEX idx_audit_log_resource ON api.audit_log USING btree (resource_type, resource_id);


--
-- Name: idx_audit_log_user; Type: INDEX; Schema: api; Owner: postgres
--

CREATE INDEX idx_audit_log_user ON api.audit_log USING btree (user_id);


--
-- Name: idx_servers_env_active; Type: INDEX; Schema: config; Owner: postgres
--

CREATE INDEX idx_servers_env_active ON config.servers USING btree (env_type, is_active);


--
-- Name: check_runs_started_at_idx; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX check_runs_started_at_idx ON monitoring.check_runs USING btree (started_at DESC);


--
-- Name: idx_metrics_ui_fast; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX idx_metrics_ui_fast ON monitoring.monitoring_metrics USING btree (server_id, metric_name, collected_at DESC);


--
-- Name: monitoring_logs_collected_at_idx; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX monitoring_logs_collected_at_idx ON monitoring.monitoring_logs USING btree (collected_at DESC);


--
-- Name: monitoring_metrics_collected_at_idx; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX monitoring_metrics_collected_at_idx ON monitoring.monitoring_metrics USING btree (collected_at DESC);


--
-- Name: uq_check_runs_server_check_scheduled; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE UNIQUE INDEX uq_check_runs_server_check_scheduled ON monitoring.check_runs USING btree (server_id, check_id, scheduled_at, started_at) WHERE (scheduled_at IS NOT NULL);


--
-- Name: ix_servers_server_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_servers_server_id ON public.servers USING btree (server_id);


--
-- Name: checks_master trg_auto_check_mappings; Type: TRIGGER; Schema: config; Owner: postgres
--

CREATE TRIGGER trg_auto_check_mappings AFTER INSERT ON config.checks_master FOR EACH ROW EXECUTE FUNCTION config.auto_insert_check_mappings();


--
-- Name: servers trg_auto_server_checks; Type: TRIGGER; Schema: config; Owner: postgres
--

CREATE TRIGGER trg_auto_server_checks AFTER INSERT ON config.servers FOR EACH ROW EXECUTE FUNCTION config.auto_insert_server_checks();


--
-- Name: _hyper_2_131_chunk 131_409_check_runs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_131_chunk
    ADD CONSTRAINT "131_409_check_runs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_2_131_chunk 131_411_check_runs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_131_chunk
    ADD CONSTRAINT "131_411_check_runs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_3_132_chunk 132_412_monitoring_logs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_132_chunk
    ADD CONSTRAINT "132_412_monitoring_logs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_3_132_chunk 132_414_monitoring_logs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_132_chunk
    ADD CONSTRAINT "132_414_monitoring_logs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_4_133_chunk 133_415_monitoring_metrics_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_133_chunk
    ADD CONSTRAINT "133_415_monitoring_metrics_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_4_133_chunk 133_417_monitoring_metrics_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_133_chunk
    ADD CONSTRAINT "133_417_monitoring_metrics_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_2_135_chunk 135_422_check_runs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_135_chunk
    ADD CONSTRAINT "135_422_check_runs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_2_135_chunk 135_424_check_runs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_135_chunk
    ADD CONSTRAINT "135_424_check_runs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_3_136_chunk 136_425_monitoring_logs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_136_chunk
    ADD CONSTRAINT "136_425_monitoring_logs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_3_136_chunk 136_427_monitoring_logs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_136_chunk
    ADD CONSTRAINT "136_427_monitoring_logs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_4_137_chunk 137_428_monitoring_metrics_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_137_chunk
    ADD CONSTRAINT "137_428_monitoring_metrics_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_4_137_chunk 137_430_monitoring_metrics_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_137_chunk
    ADD CONSTRAINT "137_430_monitoring_metrics_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_6_138_chunk 138_431_alerts_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_138_chunk
    ADD CONSTRAINT "138_431_alerts_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_6_138_chunk 138_432_alerts_incident_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_138_chunk
    ADD CONSTRAINT "138_432_alerts_incident_id_fkey" FOREIGN KEY (incident_id) REFERENCES alerts.incidents(incident_id);


--
-- Name: _hyper_6_138_chunk 138_434_alerts_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_138_chunk
    ADD CONSTRAINT "138_434_alerts_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_2_139_chunk 139_435_check_runs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_139_chunk
    ADD CONSTRAINT "139_435_check_runs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_2_139_chunk 139_437_check_runs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_139_chunk
    ADD CONSTRAINT "139_437_check_runs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_3_140_chunk 140_438_monitoring_logs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_140_chunk
    ADD CONSTRAINT "140_438_monitoring_logs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_3_140_chunk 140_440_monitoring_logs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_140_chunk
    ADD CONSTRAINT "140_440_monitoring_logs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_4_141_chunk 141_441_monitoring_metrics_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_141_chunk
    ADD CONSTRAINT "141_441_monitoring_metrics_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_4_141_chunk 141_443_monitoring_metrics_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_141_chunk
    ADD CONSTRAINT "141_443_monitoring_metrics_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_6_142_chunk 142_444_alerts_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_142_chunk
    ADD CONSTRAINT "142_444_alerts_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_6_142_chunk 142_445_alerts_incident_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_142_chunk
    ADD CONSTRAINT "142_445_alerts_incident_id_fkey" FOREIGN KEY (incident_id) REFERENCES alerts.incidents(incident_id);


--
-- Name: _hyper_6_142_chunk 142_447_alerts_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_142_chunk
    ADD CONSTRAINT "142_447_alerts_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_2_143_chunk 143_448_check_runs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_143_chunk
    ADD CONSTRAINT "143_448_check_runs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_2_143_chunk 143_450_check_runs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_2_143_chunk
    ADD CONSTRAINT "143_450_check_runs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_3_144_chunk 144_451_monitoring_logs_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_144_chunk
    ADD CONSTRAINT "144_451_monitoring_logs_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_3_144_chunk 144_453_monitoring_logs_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_3_144_chunk
    ADD CONSTRAINT "144_453_monitoring_logs_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_4_145_chunk 145_454_monitoring_metrics_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_145_chunk
    ADD CONSTRAINT "145_454_monitoring_metrics_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_4_145_chunk 145_456_monitoring_metrics_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_4_145_chunk
    ADD CONSTRAINT "145_456_monitoring_metrics_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: _hyper_6_146_chunk 146_457_alerts_check_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_146_chunk
    ADD CONSTRAINT "146_457_alerts_check_id_fkey" FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: _hyper_6_146_chunk 146_458_alerts_incident_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_146_chunk
    ADD CONSTRAINT "146_458_alerts_incident_id_fkey" FOREIGN KEY (incident_id) REFERENCES alerts.incidents(incident_id);


--
-- Name: _hyper_6_146_chunk 146_460_alerts_server_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: postgres
--

ALTER TABLE ONLY _timescaledb_internal._hyper_6_146_chunk
    ADD CONSTRAINT "146_460_alerts_server_id_fkey" FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: alerts alerts_check_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: alerts alerts_incident_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES alerts.incidents(incident_id);


--
-- Name: alerts alerts_server_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: incidents incidents_check_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents
    ADD CONSTRAINT incidents_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: incidents incidents_server_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents
    ADD CONSTRAINT incidents_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: check_thresholds check_thresholds_check_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds
    ADD CONSTRAINT check_thresholds_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id) ON DELETE CASCADE;


--
-- Name: check_thresholds check_thresholds_server_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds
    ADD CONSTRAINT check_thresholds_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id) ON DELETE CASCADE;


--
-- Name: server_checks_mapping server_checks_mapping_check_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id) ON DELETE CASCADE;


--
-- Name: server_checks_mapping server_checks_mapping_server_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id) ON DELETE CASCADE;


--
-- Name: check_runs check_runs_check_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs
    ADD CONSTRAINT check_runs_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: check_runs check_runs_server_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs
    ADD CONSTRAINT check_runs_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: monitoring_logs monitoring_logs_check_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs
    ADD CONSTRAINT monitoring_logs_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: monitoring_logs monitoring_logs_server_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs
    ADD CONSTRAINT monitoring_logs_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- Name: monitoring_metrics monitoring_metrics_check_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics
    ADD CONSTRAINT monitoring_metrics_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- Name: monitoring_metrics monitoring_metrics_server_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics
    ADD CONSTRAINT monitoring_metrics_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- PostgreSQL database dump complete
--

\unrestrict 6VrclUxcFczC3hsT60Gm4xoflzDGZQof9eaXpQ3YQdiecEezeGtuXBVeOaWRw22

