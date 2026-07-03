# app/db/connection.py

import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)


class PostgresConnectionManager:
    def __init__(self, db_config: dict):
        """
        db_config comes fully from config.yaml
        """
        self.db_config = db_config
        self._pool = None

    def initialize_pool(self):
        try:
            self._pool = psycopg2.pool.SimpleConnectionPool(
                minconn=self.db_config.get("min_connections", 1),
                maxconn=self.db_config.get("max_connections", 5),
                host=self.db_config["host"],
                port=self.db_config["port"],
                database=self.db_config["database"],
                user=self.db_config["user"],
                password=self.db_config["password"],
                connect_timeout=self.db_config.get("connect_timeout", 5)
            )
            logger.info("Connection pool initialized")

        except Exception as e:
            logger.error(f"Failed to initialize pool: {e}")
            raise

    @contextmanager
    def get_connection(self):
        conn = None
        try:
            conn = self._pool.getconn()
            conn.autocommit = True
            yield conn

        except Exception as e:
            logger.error(f"Connection error: {e}")
            raise

        finally:
            if conn:
                self._pool.putconn(conn)

    def close_all(self):
        if self._pool:
            self._pool.closeall()
            logger.info("All connections closed")