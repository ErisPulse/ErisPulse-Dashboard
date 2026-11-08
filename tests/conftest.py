import sys
from pathlib import Path

# 让 pytest 能直接导入仓库内的 ErisPulse_Dashboard 包
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
