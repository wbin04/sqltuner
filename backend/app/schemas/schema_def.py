from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ColumnDef(BaseModel):
    name: str = Field(..., description="Column name")
    type: str = Field(..., description="Column data type")
    is_pk: bool = Field(
        default=False,
        description="Whether this column is a primary key")
    is_nullable: bool = Field(
        default=True,
        description="Whether this column allows NULL values")
    default: Optional[str] = Field(
        None, description="Default value for the column")

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
    column: str = Field(...,
                        description="The column name in the current table")
    ref_table: str = Field(..., description="The referenced table name")
    ref_column: str = Field(..., description="Referenced column name")

    class Config:
        json_schema_extra = {
            "example": {
                "column": "user_id",
                "ref_table": "users",
                "ref_column": "id"
            }
        }


class IndexDef(BaseModel):
    name: str = Field(..., description="Index name")
    column_names: List[str] = Field(
        default_factory=list,
        description="List of column names covered by the index")
    unique: bool = Field(
        default=False,
        description="Whether this is a unique index")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "idx_users_email",
                "column_names": ["email"],
                "unique": False
            }
        }


class TableDef(BaseModel):
    name: str = Field(..., description="Table name")
    columns: List[ColumnDef] = Field(
        default_factory=list,
        description="List of columns in the table")
    foreign_keys: List[ForeignKeyDef] = Field(
        default_factory=list,
        description="List of foreign key relationships")
    indexes: List[IndexDef] = Field(
        default_factory=list,
        description="List of indexes on the table")
    row_count: Optional[int] = Field(
        None, description="Number of rows in the table")
    sample_data: Optional[List[Dict[str, Any]]] = Field(
        None, description="Optional sample data rows")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "users",
                "columns": [
                    {"name": "id", "type": "UUID", "is_pk": True, "is_nullable": False},  # noqa: E501
                    {"name": "email", "type": "VARCHAR", "is_pk": False, "is_nullable": False},  # noqa: E501
                    {"name": "created_at", "type": "TS", "is_pk": False, "is_nullable": False}  # noqa: E501
                ],
                "foreign_keys": [],
                "sample_data": [
                    {"id": "123e4567-e89b-12d3-a456-426614174000", "email": "user@example.com"}  # noqa: E501
                ]
            }
        }


class SchemaDef(BaseModel):
    tables: List[TableDef] = Field(
        default_factory=list,
        description="List of tables in the schema")

    class Config:
        json_schema_extra = {
            "example": {
                "tables": [
                    {
                        "name": "users",
                        "columns": [
                            {"name": "id", "type": "UUID", "is_pk": True, "is_nullable": False},  # noqa: E501
                            {"name": "email", "type": "VARCHAR(255)", "is_pk": False, "is_nullable": False}  # noqa: E501
                        ],
                        "foreign_keys": []
                    }
                ]
            }
        }

    def to_json_dict(self) -> Dict[str, Any]:
        return self.model_dump(mode='json')

    @classmethod
    def from_json_dict(cls, data: Dict[str, Any]) -> 'SchemaDef':
        return cls(**data)
