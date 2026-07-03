--
-- PostgreSQL database dump
--

\restrict ILk7SvDkVYAo7LndjnkEb591yZzZtEZOB5BeAOYTOQJE6GO7jvG8UuQQ7YQNXb5

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.6

-- Started on 2026-04-21 16:45:52

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
-- TOC entry 9 (class 2615 OID 165280)
-- Name: alerts; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA alerts;


ALTER SCHEMA alerts OWNER TO postgres;

--
-- TOC entry 7 (class 2615 OID 165278)
-- Name: config; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA config;


ALTER SCHEMA config OWNER TO postgres;

--
-- TOC entry 8 (class 2615 OID 165279)
-- Name: monitoring; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA monitoring;


ALTER SCHEMA monitoring OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 247 (class 1259 OID 165438)
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
-- TOC entry 5475 (class 0 OID 0)
-- Dependencies: 247
-- Name: COLUMN alerts.status; Type: COMMENT; Schema: alerts; Owner: postgres
--

COMMENT ON COLUMN alerts.alerts.status IS '1=WARNING, 2=CRITICAL';


--
-- TOC entry 246 (class 1259 OID 165437)
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
-- TOC entry 5476 (class 0 OID 0)
-- Dependencies: 246
-- Name: alerts_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: alerts; Owner: postgres
--

ALTER SEQUENCE alerts.alerts_alert_id_seq OWNED BY alerts.alerts.alert_id;


--
-- TOC entry 245 (class 1259 OID 165418)
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
-- TOC entry 5477 (class 0 OID 0)
-- Dependencies: 245
-- Name: COLUMN incidents.status; Type: COMMENT; Schema: alerts; Owner: postgres
--

COMMENT ON COLUMN alerts.incidents.status IS '1=OPEN, 2=RESOLVED';


--
-- TOC entry 244 (class 1259 OID 165417)
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
-- TOC entry 5478 (class 0 OID 0)
-- Dependencies: 244
-- Name: incidents_incident_id_seq; Type: SEQUENCE OWNED BY; Schema: alerts; Owner: postgres
--

ALTER SEQUENCE alerts.incidents_incident_id_seq OWNED BY alerts.incidents.incident_id;


--
-- TOC entry 243 (class 1259 OID 165397)
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
    CONSTRAINT check_thresholds_comparison_operator_check CHECK (((comparison_operator)::text = ANY ((ARRAY['>'::character varying, '<'::character varying, '='::character varying, '!='::character varying, '~'::character varying])::text[])))
);


ALTER TABLE config.check_thresholds OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 165396)
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
-- TOC entry 5479 (class 0 OID 0)
-- Dependencies: 242
-- Name: check_thresholds_threshold_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.check_thresholds_threshold_id_seq OWNED BY config.check_thresholds.threshold_id;


--
-- TOC entry 233 (class 1259 OID 165303)
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
    is_active boolean DEFAULT true
);


ALTER TABLE config.checks_master OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 165302)
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
-- TOC entry 5480 (class 0 OID 0)
-- Dependencies: 232
-- Name: checks_master_check_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.checks_master_check_id_seq OWNED BY config.checks_master.check_id;


--
-- TOC entry 235 (class 1259 OID 165316)
-- Name: server_checks_mapping; Type: TABLE; Schema: config; Owner: postgres
--

CREATE TABLE config.server_checks_mapping (
    mapping_id integer NOT NULL,
    server_id integer NOT NULL,
    check_id integer NOT NULL,
    custom_frequency_sec integer,
    is_enabled boolean DEFAULT true,
    consecutive_failures integer DEFAULT 0 NOT NULL,
    backoff_until timestamp with time zone
);


ALTER TABLE config.server_checks_mapping OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 165315)
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
-- TOC entry 5481 (class 0 OID 0)
-- Dependencies: 234
-- Name: server_checks_mapping_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.server_checks_mapping_mapping_id_seq OWNED BY config.server_checks_mapping.mapping_id;


--
-- TOC entry 231 (class 1259 OID 165282)
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
    version integer,
    tags jsonb,
    is_active boolean DEFAULT true,
    last_heartbeat timestamp with time zone,
    CONSTRAINT valid_retention_period CHECK ((retention_metrics_days >= retention_logs_days))
);


ALTER TABLE config.servers OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 165281)
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
-- TOC entry 5482 (class 0 OID 0)
-- Dependencies: 230
-- Name: servers_server_id_seq; Type: SEQUENCE OWNED BY; Schema: config; Owner: postgres
--

ALTER SEQUENCE config.servers_server_id_seq OWNED BY config.servers.server_id;


--
-- TOC entry 237 (class 1259 OID 165336)
-- Name: check_runs; Type: TABLE; Schema: monitoring; Owner: postgres
--

CREATE TABLE monitoring.check_runs (
    run_id bigint NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    scheduled_at timestamp with time zone,
    ended_at timestamp with time zone,
    server_id integer,
    check_id integer,
    status smallint,
    execution_time_ms integer,
    error_message text
);


ALTER TABLE monitoring.check_runs OWNER TO postgres;

--
-- TOC entry 5483 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN check_runs.status; Type: COMMENT; Schema: monitoring; Owner: postgres
--

COMMENT ON COLUMN monitoring.check_runs.status IS '1=SUCCESS, 2=FAILED, 3=TIMEOUT';


--
-- TOC entry 5488 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN check_runs.scheduled_at; Type: COMMENT; Schema: monitoring; Owner: postgres
--

COMMENT ON COLUMN monitoring.check_runs.scheduled_at IS 'Intended start time from scheduler; NULL = unscheduled/catch-up';


--
-- TOC entry 236 (class 1259 OID 165335)
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
-- TOC entry 5484 (class 0 OID 0)
-- Dependencies: 236
-- Name: check_runs_run_id_seq; Type: SEQUENCE OWNED BY; Schema: monitoring; Owner: postgres
--

ALTER SEQUENCE monitoring.check_runs_run_id_seq OWNED BY monitoring.check_runs.run_id;


--
-- TOC entry 239 (class 1259 OID 165356)
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
-- TOC entry 5485 (class 0 OID 0)
-- Dependencies: 239
-- Name: COLUMN monitoring_logs.status_code; Type: COMMENT; Schema: monitoring; Owner: postgres
--

COMMENT ON COLUMN monitoring.monitoring_logs.status_code IS '1=WARNING, 2=CRITICAL, 3=FAILURE';


--
-- TOC entry 238 (class 1259 OID 165355)
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
-- TOC entry 5486 (class 0 OID 0)
-- Dependencies: 238
-- Name: monitoring_logs_log_id_seq; Type: SEQUENCE OWNED BY; Schema: monitoring; Owner: postgres
--

ALTER SEQUENCE monitoring.monitoring_logs_log_id_seq OWNED BY monitoring.monitoring_logs.log_id;


--
-- TOC entry 241 (class 1259 OID 165376)
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
-- TOC entry 240 (class 1259 OID 165375)
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
-- TOC entry 5487 (class 0 OID 0)
-- Dependencies: 240
-- Name: monitoring_metrics_metric_id_seq; Type: SEQUENCE OWNED BY; Schema: monitoring; Owner: postgres
--

ALTER SEQUENCE monitoring.monitoring_metrics_metric_id_seq OWNED BY monitoring.monitoring_metrics.metric_id;


--
-- TOC entry 5243 (class 2604 OID 165441)
-- Name: alerts alert_id; Type: DEFAULT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts ALTER COLUMN alert_id SET DEFAULT nextval('alerts.alerts_alert_id_seq'::regclass);


--
-- TOC entry 5241 (class 2604 OID 165421)
-- Name: incidents incident_id; Type: DEFAULT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents ALTER COLUMN incident_id SET DEFAULT nextval('alerts.incidents_incident_id_seq'::regclass);


--
-- TOC entry 5239 (class 2604 OID 165400)
-- Name: check_thresholds threshold_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds ALTER COLUMN threshold_id SET DEFAULT nextval('config.check_thresholds_threshold_id_seq'::regclass);


--
-- TOC entry 5226 (class 2604 OID 165306)
-- Name: checks_master check_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.checks_master ALTER COLUMN check_id SET DEFAULT nextval('config.checks_master_check_id_seq'::regclass);


--
-- TOC entry 5231 (class 2604 OID 165319)
-- Name: server_checks_mapping mapping_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping ALTER COLUMN mapping_id SET DEFAULT nextval('config.server_checks_mapping_mapping_id_seq'::regclass);


--
-- TOC entry 5217 (class 2604 OID 165285)
-- Name: servers server_id; Type: DEFAULT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.servers ALTER COLUMN server_id SET DEFAULT nextval('config.servers_server_id_seq'::regclass);


--
-- TOC entry 5233 (class 2604 OID 165339)
-- Name: check_runs run_id; Type: DEFAULT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs ALTER COLUMN run_id SET DEFAULT nextval('monitoring.check_runs_run_id_seq'::regclass);


--
-- TOC entry 5235 (class 2604 OID 165359)
-- Name: monitoring_logs log_id; Type: DEFAULT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs ALTER COLUMN log_id SET DEFAULT nextval('monitoring.monitoring_logs_log_id_seq'::regclass);


--
-- TOC entry 5237 (class 2604 OID 165379)
-- Name: monitoring_metrics metric_id; Type: DEFAULT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics ALTER COLUMN metric_id SET DEFAULT nextval('monitoring.monitoring_metrics_metric_id_seq'::regclass);


--
-- TOC entry 5469 (class 0 OID 165438)
-- Dependencies: 247
-- Data for Name: alerts; Type: TABLE DATA; Schema: alerts; Owner: postgres
--

COPY alerts.alerts (alert_id, incident_id, server_id, check_id, metric_name, observed_value, status, triggered_at, acknowledged_at) FROM stdin;
\.


--
-- TOC entry 5467 (class 0 OID 165418)
-- Dependencies: 245
-- Data for Name: incidents; Type: TABLE DATA; Schema: alerts; Owner: postgres
--

COPY alerts.incidents (incident_id, server_id, check_id, status, started_at, ended_at, root_cause) FROM stdin;
\.


--
-- TOC entry 5465 (class 0 OID 165397)
-- Dependencies: 243
-- Data for Name: check_thresholds; Type: TABLE DATA; Schema: config; Owner: postgres
--

COPY config.check_thresholds (threshold_id, check_id, server_id, metric_name, warning_value_num, critical_value_num, comparison_operator, is_active) FROM stdin;
\.


--
-- TOC entry 5455 (class 0 OID 165303)
-- Dependencies: 233
-- Data for Name: checks_master; Type: TABLE DATA; Schema: config; Owner: postgres
--

COPY config.checks_master (check_id, check_code, category, check_name, query_text, timeout_ms, default_frequency_sec, created_at, updated_at, created_by, is_active) FROM stdin;
\.


--
-- TOC entry 5457 (class 0 OID 165316)
-- Dependencies: 235
-- Data for Name: server_checks_mapping; Type: TABLE DATA; Schema: config; Owner: postgres
--

COPY config.server_checks_mapping (mapping_id, server_id, check_id, custom_frequency_sec, is_enabled, consecutive_failures, backoff_until) FROM stdin;
\.


--
-- TOC entry 5453 (class 0 OID 165282)
-- Dependencies: 231
-- Data for Name: servers; Type: TABLE DATA; Schema: config; Owner: postgres
--

COPY config.servers (server_id, server_label, server_ip, port, db_name, username, password_encrypted, server_role, env_type, ssl_mode, retention_metrics_days, retention_logs_days, retention_runs_days, compression_days, created_at, updated_at, created_by, updated_by, version, tags, is_active, last_heartbeat) FROM stdin;
\.


--
-- TOC entry 5459 (class 0 OID 165336)
-- Dependencies: 237
-- Data for Name: check_runs; Type: TABLE DATA; Schema: monitoring; Owner: postgres
--

COPY monitoring.check_runs (run_id, started_at, scheduled_at, ended_at, server_id, check_id, status, execution_time_ms, error_message) FROM stdin;
\.


--
-- TOC entry 5461 (class 0 OID 165356)
-- Dependencies: 239
-- Data for Name: monitoring_logs; Type: TABLE DATA; Schema: monitoring; Owner: postgres
--

COPY monitoring.monitoring_logs (log_id, collected_at, server_id, check_id, raw_result, status_code, execution_time_ms) FROM stdin;
\.


--
-- TOC entry 5463 (class 0 OID 165376)
-- Dependencies: 241
-- Data for Name: monitoring_metrics; Type: TABLE DATA; Schema: monitoring; Owner: postgres
--

COPY monitoring.monitoring_metrics (metric_id, collected_at, server_id, check_id, metric_name, metric_value, labels) FROM stdin;
\.


--
-- TOC entry 5488 (class 0 OID 0)
-- Dependencies: 246
-- Name: alerts_alert_id_seq; Type: SEQUENCE SET; Schema: alerts; Owner: postgres
--

SELECT pg_catalog.setval('alerts.alerts_alert_id_seq', 1, false);


--
-- TOC entry 5489 (class 0 OID 0)
-- Dependencies: 244
-- Name: incidents_incident_id_seq; Type: SEQUENCE SET; Schema: alerts; Owner: postgres
--

SELECT pg_catalog.setval('alerts.incidents_incident_id_seq', 1, false);


--
-- TOC entry 5490 (class 0 OID 0)
-- Dependencies: 242
-- Name: check_thresholds_threshold_id_seq; Type: SEQUENCE SET; Schema: config; Owner: postgres
--

SELECT pg_catalog.setval('config.check_thresholds_threshold_id_seq', 1, false);


--
-- TOC entry 5491 (class 0 OID 0)
-- Dependencies: 232
-- Name: checks_master_check_id_seq; Type: SEQUENCE SET; Schema: config; Owner: postgres
--

SELECT pg_catalog.setval('config.checks_master_check_id_seq', 1, false);


--
-- TOC entry 5492 (class 0 OID 0)
-- Dependencies: 234
-- Name: server_checks_mapping_mapping_id_seq; Type: SEQUENCE SET; Schema: config; Owner: postgres
--

SELECT pg_catalog.setval('config.server_checks_mapping_mapping_id_seq', 1, false);


--
-- TOC entry 5493 (class 0 OID 0)
-- Dependencies: 230
-- Name: servers_server_id_seq; Type: SEQUENCE SET; Schema: config; Owner: postgres
--

SELECT pg_catalog.setval('config.servers_server_id_seq', 1, false);


--
-- TOC entry 5494 (class 0 OID 0)
-- Dependencies: 236
-- Name: check_runs_run_id_seq; Type: SEQUENCE SET; Schema: monitoring; Owner: postgres
--

SELECT pg_catalog.setval('monitoring.check_runs_run_id_seq', 1, false);


--
-- TOC entry 5495 (class 0 OID 0)
-- Dependencies: 238
-- Name: monitoring_logs_log_id_seq; Type: SEQUENCE SET; Schema: monitoring; Owner: postgres
--

SELECT pg_catalog.setval('monitoring.monitoring_logs_log_id_seq', 1, false);


--
-- TOC entry 5496 (class 0 OID 0)
-- Dependencies: 240
-- Name: monitoring_metrics_metric_id_seq; Type: SEQUENCE SET; Schema: monitoring; Owner: postgres
--

SELECT pg_catalog.setval('monitoring.monitoring_metrics_metric_id_seq', 1, false);


--
-- TOC entry 5273 (class 2606 OID 166175)
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (alert_id, triggered_at);


--
-- TOC entry 5271 (class 2606 OID 165426)
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (incident_id);


--
-- TOC entry 5269 (class 2606 OID 165406)
-- Name: check_thresholds check_thresholds_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds
    ADD CONSTRAINT check_thresholds_pkey PRIMARY KEY (threshold_id);


--
-- TOC entry 5253 (class 2606 OID 165314)
-- Name: checks_master checks_master_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.checks_master
    ADD CONSTRAINT checks_master_pkey PRIMARY KEY (check_id);


--
-- TOC entry 5255 (class 2606 OID 165322)
-- Name: server_checks_mapping server_checks_mapping_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_pkey PRIMARY KEY (mapping_id);


--
-- TOC entry 5257 (class 2606 OID 165324)
-- Name: server_checks_mapping server_checks_mapping_server_id_check_id_key; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_server_id_check_id_key UNIQUE (server_id, check_id);


--
-- TOC entry 5249 (class 2606 OID 165298)
-- Name: servers servers_pkey; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.servers
    ADD CONSTRAINT servers_pkey PRIMARY KEY (server_id);


--
-- TOC entry 5251 (class 2606 OID 165300)
-- Name: servers servers_server_label_key; Type: CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.servers
    ADD CONSTRAINT servers_server_label_key UNIQUE (server_label);


--
-- TOC entry 5259 (class 2606 OID 165344)
-- Name: check_runs check_runs_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs
    ADD CONSTRAINT check_runs_pkey PRIMARY KEY (run_id, started_at);


--
-- TOC entry 5263 (class 2606 OID 165364)
-- Name: monitoring_logs monitoring_logs_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs
    ADD CONSTRAINT monitoring_logs_pkey PRIMARY KEY (log_id, collected_at);


--
-- TOC entry 5267 (class 2606 OID 165384)
-- Name: monitoring_metrics monitoring_metrics_pkey; Type: CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics
    ADD CONSTRAINT monitoring_metrics_pkey PRIMARY KEY (metric_id, collected_at);


--
-- TOC entry 5274 (class 1259 OID 166176)
-- Name: alerts_triggered_at_idx; Type: INDEX; Schema: alerts; Owner: postgres
--

CREATE INDEX alerts_triggered_at_idx ON alerts.alerts USING btree (triggered_at DESC);


--
-- TOC entry 5247 (class 1259 OID 165301)
-- Name: idx_servers_env_active; Type: INDEX; Schema: config; Owner: postgres
--

CREATE INDEX idx_servers_env_active ON config.servers USING btree (env_type, is_active);


--
-- TOC entry 5260 (class 1259 OID 166171)
-- Name: check_runs_started_at_idx; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX check_runs_started_at_idx ON monitoring.check_runs USING btree (started_at DESC);


--
-- TOC entry 5264 (class 1259 OID 165395)
-- Name: idx_metrics_ui_fast; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX idx_metrics_ui_fast ON monitoring.monitoring_metrics USING btree (server_id, metric_name, collected_at DESC);


--
-- TOC entry 5261 (class 1259 OID 166172)
-- Name: monitoring_logs_collected_at_idx; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX monitoring_logs_collected_at_idx ON monitoring.monitoring_logs USING btree (collected_at DESC);


--
-- TOC entry 5265 (class 1259 OID 166173)
-- Name: monitoring_metrics_collected_at_idx; Type: INDEX; Schema: monitoring; Owner: postgres
--

CREATE INDEX monitoring_metrics_collected_at_idx ON monitoring.monitoring_metrics USING btree (collected_at DESC);


--
-- TOC entry 5287 (class 2606 OID 165457)
-- Name: alerts alerts_check_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- TOC entry 5288 (class 2606 OID 165447)
-- Name: alerts alerts_incident_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES alerts.incidents(incident_id);


--
-- TOC entry 5289 (class 2606 OID 165452)
-- Name: alerts alerts_server_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.alerts
    ADD CONSTRAINT alerts_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- TOC entry 5285 (class 2606 OID 165432)
-- Name: incidents incidents_check_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents
    ADD CONSTRAINT incidents_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- TOC entry 5286 (class 2606 OID 165427)
-- Name: incidents incidents_server_id_fkey; Type: FK CONSTRAINT; Schema: alerts; Owner: postgres
--

ALTER TABLE ONLY alerts.incidents
    ADD CONSTRAINT incidents_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- TOC entry 5283 (class 2606 OID 165407)
-- Name: check_thresholds check_thresholds_check_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds
    ADD CONSTRAINT check_thresholds_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id) ON DELETE CASCADE;


--
-- TOC entry 5284 (class 2606 OID 165412)
-- Name: check_thresholds check_thresholds_server_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.check_thresholds
    ADD CONSTRAINT check_thresholds_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id) ON DELETE CASCADE;


--
-- TOC entry 5275 (class 2606 OID 165330)
-- Name: server_checks_mapping server_checks_mapping_check_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id) ON DELETE CASCADE;


--
-- TOC entry 5276 (class 2606 OID 165325)
-- Name: server_checks_mapping server_checks_mapping_server_id_fkey; Type: FK CONSTRAINT; Schema: config; Owner: postgres
--

ALTER TABLE ONLY config.server_checks_mapping
    ADD CONSTRAINT server_checks_mapping_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id) ON DELETE CASCADE;


--
-- TOC entry 5277 (class 2606 OID 165350)
-- Name: check_runs check_runs_check_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs
    ADD CONSTRAINT check_runs_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- TOC entry 5278 (class 2606 OID 165345)
-- Name: check_runs check_runs_server_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.check_runs
    ADD CONSTRAINT check_runs_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- TOC entry 5279 (class 2606 OID 165370)
-- Name: monitoring_logs monitoring_logs_check_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs
    ADD CONSTRAINT monitoring_logs_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- TOC entry 5280 (class 2606 OID 165365)
-- Name: monitoring_logs monitoring_logs_server_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_logs
    ADD CONSTRAINT monitoring_logs_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


--
-- TOC entry 5281 (class 2606 OID 165390)
-- Name: monitoring_metrics monitoring_metrics_check_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics
    ADD CONSTRAINT monitoring_metrics_check_id_fkey FOREIGN KEY (check_id) REFERENCES config.checks_master(check_id);


--
-- TOC entry 5282 (class 2606 OID 165385)
-- Name: monitoring_metrics monitoring_metrics_server_id_fkey; Type: FK CONSTRAINT; Schema: monitoring; Owner: postgres
--

ALTER TABLE ONLY monitoring.monitoring_metrics
    ADD CONSTRAINT monitoring_metrics_server_id_fkey FOREIGN KEY (server_id) REFERENCES config.servers(server_id);


-- Completed on 2026-04-21 16:45:52

--
-- PostgreSQL database dump complete
--

\unrestrict ILk7SvDkVYAo7LndjnkEb591yZzZtEZOB5BeAOYTOQJE6GO7jvG8UuQQ7YQNXb5

