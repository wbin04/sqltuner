"""
Pydantic models for database schema definitions
Used for validating meta_schema JSONB structure
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ColumnDef(BaseModel):
    """Definition of a database column"""
    name: str = Field(..., description="Column name")
    type: str = Field(..., description="Column data type (e.g., VARCHAR, INTEGER, TIMESTAMP)")
    is_pk: bool = Field(default=False, description="Whether this column is a primary key")
    is_nullable: bool = Field(default=True, description="Whether this column allows NULL values")
    default: Optional[str] = Field(None, description="Default value for the column")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "id",
                "type": "UUID",
                "is_pk": True,
                "is_nullable": False
            }
        }


class ForeignKeyDef(BaseModel):
    """Definition of a foreign key relationship"""
    column: str = Field(..., description="The column name in the current table")
    ref_table: str = Field(..., description="The referenced table name")
    ref_column: str = Field(..., description="The referenced column name in the target table")
    
    class Config:
        json_schema_extra = {
            "example": {
                "column": "user_id",
                "ref_table": "users",
                "ref_column": "id"
            }
        }


class IndexDef(BaseModel):
    """Definition of a database index"""
    name: str = Field(..., description="Index name")
    column_names: List[str] = Field(default_factory=list, description="List of column names covered by the index")
    unique: bool = Field(default=False, description="Whether this is a unique index")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "idx_users_email",
                "column_names": ["email"],
                "unique": False
            }
        }


class TableDef(BaseModel):
    """Definition of a database table"""
    name: str = Field(..., description="Table name")
    columns: List[ColumnDef] = Field(default_factory=list, description="List of columns in the table")
    foreign_keys: List[ForeignKeyDef] = Field(default_factory=list, description="List of foreign key relationships")
    indexes: List[IndexDef] = Field(default_factory=list, description="List of indexes on the table")
    row_count: Optional[int] = Field(None, description="Number of rows in the table")
    sample_data: Optional[List[Dict[str, Any]]] = Field(None, description="Optional sample data rows")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "users",
                "columns": [
                    {"name": "id", "type": "UUID", "is_pk": True, "is_nullable": False},
                    {"name": "email", "type": "VARCHAR(255)", "is_pk": False, "is_nullable": False},
                    {"name": "created_at", "type": "TIMESTAMP", "is_pk": False, "is_nullable": False}
                ],
                "foreign_keys": [],
                "sample_data": [
                    {"id": "123e4567-e89b-12d3-a456-426614174000", "email": "user@example.com"}
                ]
            }
        }


class SchemaDef(BaseModel):
    """Complete database schema definition"""
    tables: List[TableDef] = Field(default_factory=list, description="List of tables in the schema")
    
    class Config:
        json_schema_extra = {
            "example": {
                "tables": [
                    {
                        "name": "users",
                        "columns": [
                            {"name": "id", "type": "UUID", "is_pk": True, "is_nullable": False},
                            {"name": "email", "type": "VARCHAR(255)", "is_pk": False, "is_nullable": False}
                        ],
                        "foreign_keys": []
                    }
                ]
            }
        }
    
    def to_json_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary"""
        return self.model_dump(mode='json')
    
    @classmethod
    def from_json_dict(cls, data: Dict[str, Any]) -> 'SchemaDef':
        """Create SchemaDef from JSON dictionary"""
        return cls(**data)
