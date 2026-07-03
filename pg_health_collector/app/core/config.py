from pathlib import Path
from typing import Any, Dict

import yaml


def load_config(path: str = "configs/config.yaml") -> Dict[str, Any]:
    config_path = Path(path)
    with config_path.open("r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    return data
