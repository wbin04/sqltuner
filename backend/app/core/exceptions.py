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
