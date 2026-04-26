class NotFoundError(Exception):
    def __init__(self, message: str = "Resource not found"):
        self.message = message
        super().__init__(self.message)


class ValidationError(Exception):
    def __init__(self, message: str = "Validation failed"):
        self.message = message
        super().__init__(self.message)


class AuthenticationError(Exception):
    def __init__(self, message: str = "Authentication failed"):
        self.message = message
        super().__init__(self.message)


class DatabaseConnectionError(Exception):
    def __init__(self, message: str = "Database connection failed"):
        self.message = message
        super().__init__(self.message)


class LLMServiceError(Exception):
    def __init__(self, message: str = "LLM service error"):
        self.message = message
        super().__init__(self.message)


class ExecutionError(Exception):
    def __init__(self, message: str = "Query execution failed"):
        self.message = message
        super().__init__(self.message)


class PermissionDeniedError(Exception):
    def __init__(self, message: str = "Permission denied"):
        self.message = message
        super().__init__(self.message)


import re

def format_db_error(error_str: str) -> str:
    """Format a database error message to be more user-friendly by stripping driver/ORM wrappers."""
    if not isinstance(error_str, str):
        error_str = str(error_str)
        
    # Remove SQL statement block
    error_str = re.sub(r'\[SQL:.*?\]', '', error_str, flags=re.DOTALL)
    # Remove SQLAlchemy background link
    error_str = re.sub(r'\(Background on this error at:.*?\)', '', error_str, flags=re.DOTALL)
    # Remove (sqlalchemy.exc.ProgrammingError) and similar class wrappers
    error_str = re.sub(r'\(sqlalchemy\.[^\)]+\)\s*', '', error_str)
    # Remove sqlalchemy.exc.ProgrammingError: 
    error_str = re.sub(r'sqlalchemy\.exc\.[a-zA-Z]+:\s*', '', error_str)
    # Remove (psycopg2.errors.UndefinedFunction) and similar class wrappers
    error_str = re.sub(r'\(psycopg2\.[^\)]+\)\s*', '', error_str)
    # Remove <class 'asyncpg.exceptions.UndefinedTableError'>:
    error_str = re.sub(r'<class \'[^\']+\'>:\s*', '', error_str)
    # Remove "Statement X failed: " prefix from ExecutionError
    error_str = re.sub(r'Statement \d+ failed:\s*', '', error_str)
    
    return error_str.strip()

