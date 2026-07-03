from pathlib import Path
import re
from typing import Any, Iterable, Optional

from app.utils.file_loader import load_sql_file


class QueryExecutor:
    def __init__(self, connection_manager):
        self.connection_manager = connection_manager
        self._query_cache: dict[str, tuple[str, list[int]]] = {}
        self._queries_dir = Path(__file__).resolve().parents[1] / "queries"

    def _get_sql(self, relative_path: str) -> tuple[str, list[int]]:
        if relative_path not in self._query_cache:
            full_path = self._queries_dir / relative_path
            raw_sql = load_sql_file(str(full_path))
            self._query_cache[relative_path] = self._adapt_postgres_placeholders(raw_sql)
        return self._query_cache[relative_path]

    @staticmethod
    def _adapt_postgres_placeholders(sql: str) -> tuple[str, list[int]]:
        # Preserve original index mapping because placeholder appearance order can be $3,$4,...,$1,$2.
        placeholder_indexes = [int(x) for x in re.findall(r"\$(\d+)", sql)]
        converted_sql = re.sub(r"\$\d+", "%s", sql)
        return converted_sql, placeholder_indexes

    @staticmethod
    def _map_params(params: Optional[Iterable[Any]], placeholder_indexes: list[int]) -> tuple[Any, ...]:
        provided = tuple(params or ())
        if not placeholder_indexes:
            return provided
        return tuple(provided[i - 1] for i in placeholder_indexes)

    def fetch_all(self, relative_path: str, params: Optional[Iterable[Any]] = None):
        sql, placeholder_indexes = self._get_sql(relative_path)
        mapped_params = self._map_params(params, placeholder_indexes)
        with self.connection_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, mapped_params)
                rows = cur.fetchall()
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in rows]

    def fetch_one(self, relative_path: str, params: Optional[Iterable[Any]] = None):
        sql, placeholder_indexes = self._get_sql(relative_path)
        mapped_params = self._map_params(params, placeholder_indexes)
        with self.connection_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, mapped_params)
                row = cur.fetchone()
                if row is None:
                    return None
                columns = [desc[0] for desc in cur.description]
                return dict(zip(columns, row))

    def execute(self, relative_path: str, params: Optional[Iterable[Any]] = None):
        sql, placeholder_indexes = self._get_sql(relative_path)
        mapped_params = self._map_params(params, placeholder_indexes)
        with self.connection_manager.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, mapped_params)
