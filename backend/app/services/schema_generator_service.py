import logging
from typing import Any, Dict, Optional

from app.schemas.schema_def import ColumnDef, ForeignKeyDef, IndexDef, SchemaDef, TableDef
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class SchemaGeneratorService:
    async def check_clarification(self, description: str) -> Dict[str, Any]:
        return await llm_service.check_schema_clarification(description)

    async def generate(
        self,
        description: str,
        clarifications: Optional[list[dict]] = None,
    ) -> Dict[str, Any]:
        raw_schema = await llm_service.generate_schema_from_prompt(
            description,
            clarifications,
        )

        schema_def = self._convert_to_schema_def(raw_schema)

        return {
            "schema_def": schema_def,
            "raw": raw_schema,
            "system_name": raw_schema.get("system_name", "Generated Schema"),
            "relationships": raw_schema.get("relationships", []),
            "design_notes": raw_schema.get("design_notes", []),
        }

    def _convert_to_schema_def(self, raw: dict) -> SchemaDef:
        tables = []

        for table in raw.get("tables", []):
            columns = [
                ColumnDef(
                    name=col["name"],
                    type=col["type"],
                    is_pk=col.get("is_pk", False),
                    is_nullable=col.get("is_nullable", True),
                    default=col.get("default"),
                )
                for col in table.get("columns", [])
            ]

            foreign_keys = [
                ForeignKeyDef(
                    column=fk["column"],
                    ref_table=fk["ref_table"],
                    ref_column=fk.get("ref_column", "id"),
                )
                for fk in table.get("foreign_keys", [])
            ]

            indexes = [
                IndexDef(
                    name=idx["name"],
                    column_names=idx.get("column_names", []),
                    unique=idx.get("unique", False),
                )
                for idx in table.get("indexes", [])
            ]

            tables.append(
                TableDef(
                    name=table["name"],
                    columns=columns,
                    foreign_keys=foreign_keys,
                    indexes=indexes,
                    sample_data=[],
                )
            )

        return SchemaDef(tables=tables)

    def generate_mermaid_erd(self, raw: dict) -> str:
        lines = ["erDiagram"]

        for table in raw.get("tables", []):
            table_name = table["name"].upper()
            lines.append(f"  {table_name} {{")

            fk_columns = {fk["column"] for fk in table.get("foreign_keys", [])}
            for col in table.get("columns", []):
                constraints = []
                if col.get("is_pk"):
                    constraints.append("PK")
                if col.get("name") in fk_columns:
                    constraints.append("FK")
                marker = " ".join(constraints)
                lines.append(f"    {col['type']} {col['name']} {marker}".rstrip())

            lines.append("  }")

        type_map = {
            "many_to_one": "}o--||",
            "one_to_many": "||--o{",
            "one_to_one": "||--||",
            "many_to_many": "}o--o{",
        }

        for rel in raw.get("relationships", []):
            symbol = type_map.get(rel.get("type", ""), "||--o{")
            from_t = rel.get("from_table", "").upper()
            to_t = rel.get("to_table", "").upper()
            desc = rel.get("description", "")
            if from_t and to_t:
                lines.append(f'  {from_t} {symbol} {to_t} : "{desc}"')

        return "\n".join(lines)


schema_generator_service = SchemaGeneratorService()
