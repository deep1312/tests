from pathlib import Path


def load_sql_file(path: str) -> str:
    """
    Load an SQL file and return its text.
    """
    sql_path = Path(path)
    return sql_path.read_text(encoding="utf-8").strip()
