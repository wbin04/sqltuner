from dataclasses import dataclass
from typing import List

import sqlglot
from sqlglot import exp


@dataclass
class SqlIssue:
    type: str
    severity: str
    message: str
    suggestion: str


class SqlAntiPatternDetector:
    """Static SQL anti-pattern analysis without database access."""

    def detect(self, sql: str) -> List[SqlIssue]:
        issues = []
        try:
            parsed = sqlglot.parse_one(sql)
        except Exception:
            return issues

        issues += self._check_select_star(parsed)
        issues += self._check_in_subquery(parsed)
        issues += self._check_function_on_column(parsed)
        issues += self._check_leading_wildcard_like(parsed)
        issues += self._check_or_conditions(parsed)
        issues += self._check_implicit_type_conversion(parsed)
        issues += self._check_distinct_overuse(parsed)

        return issues

    def _check_select_star(self, parsed) -> List[SqlIssue]:
        stars = list(parsed.find_all(exp.Star))
        if stars:
            return [
                SqlIssue(
                    type="select_star",
                    severity="medium",
                    message=(
                        "SELECT * fetches all columns including unused ones, "
                        "increasing I/O"
                    ),
                    suggestion="Specify only needed columns: SELECT id, name, email FROM ...",
                )
            ]
        return []

    def _check_in_subquery(self, parsed) -> List[SqlIssue]:
        issues = []
        for node in parsed.find_all(exp.In):
            if isinstance(node.args.get("query"), exp.Subquery):
                issues.append(
                    SqlIssue(
                        type="in_subquery",
                        severity="high",
                        message="IN (SELECT ...) subquery can cause repeated full scans",
                        suggestion="Rewrite as INNER JOIN or use EXISTS for better performance",
                    )
                )
        return issues

    def _check_function_on_column(self, parsed) -> List[SqlIssue]:
        issues = []
        blocking_funcs = {
            "year",
            "month",
            "day",
            "date",
            "to_char",
            "extract",
            "lower",
            "upper",
            "trim",
            "substr",
            "substring",
        }

        for func in parsed.find_all(exp.Anonymous):
            if func.name.lower() in blocking_funcs:
                issues.append(
                    SqlIssue(
                        type="function_on_column",
                        severity="high",
                        message=(
                            f"Function {func.name.upper()}() wrapping a column "
                            "prevents index usage"
                        ),
                        suggestion=(
                            "Rewrite as range condition instead: "
                            "col >= '...' AND col < '...'"
                        ),
                    )
                )

        return issues

    def _check_leading_wildcard_like(self, parsed) -> List[SqlIssue]:
        issues = []
        for like_node in parsed.find_all(exp.Like):
            pattern = like_node.args.get("expression")
            if pattern and str(pattern).startswith("'%"):
                issues.append(
                    SqlIssue(
                        type="leading_wildcard",
                        severity="high",
                        message=(
                            "LIKE '%value' with leading wildcard cannot use "
                            "B-tree index -> full scan"
                        ),
                        suggestion=(
                            "Use full-text search (tsvector/GIN index) or "
                            "reverse index trick"
                        ),
                    )
                )
        return issues

    def _check_or_conditions(self, parsed) -> List[SqlIssue]:
        for _ in parsed.find_all(exp.Or):
            return [
                SqlIssue(
                    type="or_condition",
                    severity="low",
                    message=(
                        "OR conditions may prevent the planner from using "
                        "indexes optimally"
                    ),
                    suggestion=(
                        "Consider rewriting as UNION ALL if each branch can "
                        "use a separate index"
                    ),
                )
            ]
        return []

    def _check_implicit_type_conversion(self, parsed) -> List[SqlIssue]:
        issues = []
        for eq_node in parsed.find_all(exp.EQ):
            left = eq_node.left
            right = eq_node.right

            if isinstance(left, exp.Column) and isinstance(right, exp.Literal):
                if right.is_string and left.name.lower() in {"id", "user_id", "order_id"}:
                    issues.append(
                        SqlIssue(
                            type="implicit_type_conversion",
                            severity="medium",
                            message=(
                                f"Comparing numeric column '{left.name}' with "
                                "string literal causes implicit cast"
                            ),
                            suggestion=(
                                f"Use numeric literal: WHERE {left.name} = 123 "
                                "(not '123')"
                            ),
                        )
                    )

        return issues

    def _check_distinct_overuse(self, parsed) -> List[SqlIssue]:
        for _ in parsed.find_all(exp.Distinct):
            return [
                SqlIssue(
                    type="distinct_overuse",
                    severity="low",
                    message=(
                        "DISTINCT may indicate duplicate rows caused by "
                        "incorrect JOIN"
                    ),
                    suggestion=(
                        "Check JOIN conditions first; if intentional, GROUP BY "
                        "is often faster"
                    ),
                )
            ]
        return []


sql_analyzer = SqlAntiPatternDetector()
