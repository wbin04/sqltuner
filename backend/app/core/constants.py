"""
Application constants
"""

# Default timeout for LLM requests (seconds)
# Increased to 300s for sqlcoder-thesis model (large model, slow inference)
LLM_REQUEST_TIMEOUT = 300

# Maximum SQL query length
MAX_SQL_LENGTH = 10000

# Supported database types
SUPPORTED_DB_TYPES = ["postgresql", "mysql", "sqlite"]
