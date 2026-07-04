"""
Evaluation API endpoint.
Reads eval_results.json from the evaluation directory and serves it to the admin UI.
"""
import json
import logging
from pathlib import Path
from typing import Optional

from app.api.v1.endpoints.admin import require_admin
from app.models.models import User
from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)

router = APIRouter()

# Resolve the evaluation results file path relative to the project root
# Backend is at /backend/app/api/v1/endpoints/ → project root is 5 levels up
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent.parent.parent.parent  # → SQLTuner/
_EVAL_RESULTS_PATH = _PROJECT_ROOT / "evaluation" / "eval_results.json"


@router.get("/results")
async def get_evaluation_results(
    admin: User = Depends(require_admin),
):
    """
    Return the full evaluation results JSON.
    Reads from evaluation/eval_results.json in the project root.
    """
    # Try multiple possible paths
    possible_paths = [
        _EVAL_RESULTS_PATH,
        Path("evaluation/eval_results.json"),
        Path("../evaluation/eval_results.json"),
    ]

    results_path: Optional[Path] = None
    for p in possible_paths:
        if p.exists():
            results_path = p
            break

    if not results_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evaluation results file not found. Run evaluation first. Searched: {_EVAL_RESULTS_PATH}",
        )

    try:
        with open(results_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid JSON in eval_results.json: {e}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read evaluation results: {e}",
        )
