import logging
from typing import Any, Dict, List

from app.services.mock_data_service import MockDataService
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


class ColumnDefRequest(BaseModel):
    name: str = Field(...,
                      description="Column name")
    type: str = Field(...,
                      description="Column data type")
    is_pk: bool = Field(default=False,
                        description="Whether this is a primary key")
    is_nullable: bool = Field(default=True,
                              description="Whether this column allows NULL")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "email",
                "type": "VARCHAR",
                "is_pk": False,
                "is_nullable": False
            }
        }


class GenerateMockDataRequest(BaseModel):
    count: int = Field(
        ...,
        ge=1,
        le=1000,
        description="Number of rows to generate (1-1000)"
    )
    columns: List[ColumnDefRequest] = Field(
        ...,
        min_length=1,
        description="List of column definitions"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "count": 50,
                "columns": [
                    {"name": "id", "type": "UUID", "is_pk": True},
                    {"name": "email", "type": "VARCHAR"},
                    {"name": "name", "type": "VARCHAR"},
                    {"name": "age", "type": "INTEGER"}
                ]
            }
        }


class GenerateMockDataResponse(BaseModel):
    data: List[Dict[str, Any]] = Field(..., description="Generated rows")
    count: int = Field(..., description="Number of rows generated")


class GenerateDataWithFKResponse(BaseModel):
    data: List[Dict[str, Any]] = Field(
        ..., description="Generated rows for requested table"
    )
    count: int = Field(..., description="Number of rows generated")
    updated_schema: Dict[str, Any] = Field(
        ...,
        description="Full schema with updated sample_data "
        "(may include auto-generated parent tables)"
    )
    tables_modified: List[str] = Field(
        default_factory=list,
        description="List of table names that were modified"
    )


class GenerateDataWithSchemaRequest(BaseModel):
    table_name: str = Field(
        ...,
        description="Name of the table to generate data for"
    )
    count: int = Field(
        ...,
        ge=1,
        le=1000,
        description="Number of rows to generate (1-1000)"
    )
    schema: Dict[str, Any] = Field(
        ...,
        description="Full schema with tables, columns, and foreign keys"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "table_name": "orders",
                "count": 50,
                "schema": {
                    "tables": [
                        {
                            "name": "users",
                            "columns": [
                                {"name": "id", "type": "UUID", "is_pk": True}
                            ],
                            "foreign_keys": [],
                            "sample_data": [
                                {"id": "123e4567-e89b-12d3-a456-426614174000"}
                            ]
                        },
                        {
                            "name": "orders",
                            "columns": [
                                {"name": "id", "type": "UUID", "is_pk": True},
                                {"name": "user_id", "type": "UUID"},
                                {"name": "total", "type": "DECIMAL"}
                            ],
                            "foreign_keys": [
                                {
                                    "column": "user_id",
                                    "ref_table": "users",
                                    "ref_column": "id"
                                }
                            ]
                        }
                    ]
                }
            }
        }


@router.post(
    "/generate-data",
    response_model=GenerateMockDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate mock data for simulation",
    description="Generate realistic sample data using Faker library"
    "with smart heuristics based on column names and types"
)
async def generate_mock_data(request: GenerateMockDataRequest):
    try:
        mock_service = MockDataService()

        columns = [col.model_dump() for col in request.columns]

        generated_data = mock_service.generate(
            columns=columns,
            count=request.count
        )

        return GenerateMockDataResponse(
            data=generated_data,
            count=len(generated_data)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate mock data: {str(e)}"
        )


@router.post(
    "/generate-data-with-fk",
    response_model=GenerateDataWithFKResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate mock data with Foreign Key support",
    description="Generate realistic sample data that respects "
    "foreign key constraints. Auto-generates parent table data if empty."
)
async def generate_mock_data_with_fk(
    request: GenerateDataWithSchemaRequest
):
    try:
        tables = request.schema.get('tables', [])
        logger.info(
            f"Generating data for '{request.table_name}' "
            f"({request.count} rows)"
        )

        tables_before = {
            t['name']: len(t.get('sample_data', []))
            for t in tables
        }

        mock_service = MockDataService()

        generated_data = mock_service.generate_with_fk(
            table_name=request.table_name,
            schema_json=request.schema,
            count=request.count
        )

        tables_after = {
            t['name']: len(t.get('sample_data', []))
            for t in request.schema.get('tables', [])
        }

        tables_modified = [
            name for name in tables_after
            if tables_after.get(name, 0) != tables_before.get(name, 0)
        ]

        logger.info(f"Tables modified: {tables_modified}")

        return GenerateDataWithFKResponse(
            data=generated_data,
            count=len(generated_data),
            updated_schema=request.schema,
            tables_modified=tables_modified
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate mock data: {str(e)}"
        )
