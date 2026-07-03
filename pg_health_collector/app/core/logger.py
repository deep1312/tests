import logging
from datetime import datetime
from pathlib import Path


class ErrorOnlyFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.levelno >= logging.ERROR


def configure_logging(level: int = logging.INFO) -> None:
    log_format = "%(asctime)s %(levelname)s [%(name)s] %(message)s"
    formatter = logging.Formatter(log_format)

    project_root = Path(__file__).resolve().parents[2]
    logs_dir = project_root / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    day_log_file = logs_dir / f"{datetime.now().strftime('%Y-%m-%d')}.log"
    day_error_log_file = logs_dir / f"{datetime.now().strftime('%Y-%m-%d')}.error.log"

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers.clear()

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    file_handler = logging.FileHandler(day_log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    error_file_handler = logging.FileHandler(day_error_log_file, encoding="utf-8")
    error_file_handler.setFormatter(formatter)
    error_file_handler.addFilter(ErrorOnlyFilter())
    root_logger.addHandler(error_file_handler)
