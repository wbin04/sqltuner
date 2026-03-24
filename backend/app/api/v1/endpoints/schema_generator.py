import logging
from typing import List, Optional

from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User
from app.services.schema_generator_service import schema_generator_service
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()
logger = logging.getLogger(__name__)


class ClarificationAnswer(BaseModel):
    question: str
    answer: str


class GenerateSchemaRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Natural language description of the system to build",
    )
    clarifications: Optional[List[ClarificationAnswer]] = Field(
        default=None,
        description="Optional answers to clarification questions",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Hệ thống quản lý thư viện cho phép thành viên mượn và trả sách, theo dõi lịch sử và tính phí phạt quá hạn",
                "clarifications": [
                    {
                        "question": "Một bản sao vật lý của sách có được theo dõi riêng không?",
                        "answer": "Có, mỗi quyển sách có nhiều bản copy",
                    }
                ],
            }
        }


class CheckClarificationRequest(BaseModel):
    description: str = Field(..., min_length=5, max_length=2000)


class ClarificationQuestion(BaseModel):
    question: str
    why: str
    options: List[str]


class CheckClarificationResponse(BaseModel):
    needs_clarification: bool
    questions: List[ClarificationQuestion]


class GenerateSchemaResponse(BaseModel):
    system_name: str
    schema_def: dict
    mermaid_erd: str
    relationships: list
    design_notes: list
    table_count: int
    table_summaries: List[dict]


@router.post(
    "/check-clarification",
    response_model=CheckClarificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Check if description needs clarification before generating schema",
)
async def check_clarification(
    request: CheckClarificationRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = await schema_generator_service.check_clarification(
            request.description
        )
        return CheckClarificationResponse(
            needs_clarification=result.get("needs_clarification", False),
            questions=[
                ClarificationQuestion(**q)
                for q in result.get("questions", [])
            ],
        )
    except Exception as e:
        logger.error(f"[SCHEMA-GEN] Clarification check failed: {e}")
        return CheckClarificationResponse(
            needs_clarification=False,
            questions=[],
        )


@router.post(
    "/generate",
    response_model=GenerateSchemaResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate database schema from natural language description",
)
async def generate_schema(
    request: GenerateSchemaRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        clarifications = (
            [c.model_dump() for c in request.clarifications]
            if request.clarifications
            else None
        )

        result = await schema_generator_service.generate(
            description=request.description,
            clarifications=clarifications,
        )

        schema_def = result["schema_def"]
        raw = result["raw"]
        mermaid_erd = schema_generator_service.generate_mermaid_erd(raw)

        table_summaries = [
            {
                "name": t.get("name", ""),
                "purpose": t.get("purpose", ""),
                "design_rationale": t.get("design_rationale", ""),
                "column_count": len(t.get("columns", [])),
                "index_count": len(t.get("indexes", [])),
            }
            for t in raw.get("tables", [])
        ]

        return GenerateSchemaResponse(
            system_name=result["system_name"],
            schema_def=schema_def.to_json_dict(),
            mermaid_erd=mermaid_erd,
            relationships=result["relationships"],
            design_notes=result["design_notes"],
            table_count=len(schema_def.tables),
            table_summaries=table_summaries,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"[SCHEMA-GEN] Generate failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Schema generation failed: {str(e)}",
        )
