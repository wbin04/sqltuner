import logging
import random
import re
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from app.core.constants import (MOCK_DATA_AGE_MAX, MOCK_DATA_AGE_MIN,
                                MOCK_DATA_AUTO_PARENT_ROWS,
                                MOCK_DATA_BIGINT_MAX, MOCK_DATA_BINARY_LENGTH,
                                MOCK_DATA_DEFAULT_LOCALE,
                                MOCK_DATA_DESCRIPTION_MAX_CHARS,
                                MOCK_DATA_FLOAT_MAX, MOCK_DATA_FLOAT_MIN,
                                MOCK_DATA_INT_MAX, MOCK_DATA_INT_MIN,
                                MOCK_DATA_MONEY_MAX, MOCK_DATA_PRICE_MAX,
                                MOCK_DATA_PRICE_MIN,
                                MOCK_DATA_RECURSION_MAX_DEPTH,
                                MOCK_DATA_SERIAL_MIN, MOCK_DATA_SMALLINT_MAX,
                                MOCK_DATA_TEXT_LONG_SENTENCES,
                                MOCK_DATA_TEXT_SHORT_SENTENCES,
                                MOCK_DATA_TINYINT_MAX, MOCK_DATA_TITLE_WORDS,
                                MOCK_DATA_VARCHAR_ABSOLUTE_MAX,
                                MOCK_DATA_VARCHAR_DEFAULT_MAX,
                                MOCK_DATA_VARCHAR_SHORT_THRESHOLD)
from faker import Faker

logger = logging.getLogger(__name__)


class MockDataService:
    def __init__(self, locale: str = MOCK_DATA_DEFAULT_LOCALE):
        self.faker = Faker(locale)
        self._init_patterns()

    def _init_patterns(self):
        f = self.faker

        self.NAME_PATTERNS = {
            r'email|e_?mail|mail': lambda: f.email(),
            r'^(full)?_?name$|^username$|^user_?name$': lambda: f.name(),
            r'first_?name|fname': lambda: f.first_name(),
            r'last_?name|lname|surname': lambda: f.last_name(),
            r'phone|mobile|telephone|tel|cell': lambda: f.phone_number(),
            r'^address$': lambda: f.address().replace('\n', ', '),
            r'street': lambda: f.street_address(),
            r'^city$|^town$': lambda: f.city(),
            r'state|province|region': lambda: f.state(),
            r'country|nation': lambda: f.country(),
            r'zip|postal|postcode': lambda: f.zipcode(),
            r'company|organization|org': lambda: f.company(),
            r'job|position|role': lambda: f.job(),
            r'url|website|site|homepage': lambda: f.url(),
            r'domain': lambda: f.domain_name(),
            r'^ip$|ip_?address|ipv4': lambda: f.ipv4(),
            r'ipv6|ip6': lambda: f.ipv6(),
            r'mac|mac_?address': lambda: f.mac_address(),
            r'user_?agent|useragent|ua': lambda: f.user_agent(),
            r'description|desc|bio|about':
                lambda: f.text(max_nb_chars=MOCK_DATA_DESCRIPTION_MAX_CHARS),
            r'comment|note|remark|message': lambda: f.sentence(),
            r'^title$|heading|subject':
                lambda: f.sentence(nb_words=MOCK_DATA_TITLE_WORDS)[:-1],
            r'slug|permalink': lambda: f.slug(),
            r'price|cost|amount|salary|revenue':
                lambda: round(f.random.uniform(
                    MOCK_DATA_PRICE_MIN, MOCK_DATA_PRICE_MAX
                ), 2),
            r'currency': lambda: f.currency_code(),
            r'card|credit_?card|cc': lambda: f.credit_card_number(),
            r'uuid|guid': lambda: str(uuid4()),
            r'created_?at|createdat|^created$|creation':
                lambda: f.date_time_this_year().isoformat(),
            r'updated_?at|updatedat|^updated$|modified':
                lambda: f.date_time_this_month().isoformat(),
            r'birth|dob|birthday':
                lambda: f.date_of_birth(
                    minimum_age=MOCK_DATA_AGE_MIN,
                    maximum_age=MOCK_DATA_AGE_MAX
                ).isoformat(),
            r'age':
                lambda: f.random_int(
                    min=MOCK_DATA_AGE_MIN, max=MOCK_DATA_AGE_MAX
                ),
            r'^date$': lambda: f.date_this_year().isoformat(),
            r'status':
                lambda: random.choice([
                    'active', 'inactive', 'pending', 'completed'
                ]),
            r'category|type': lambda: f.word(),
            r'colou?r': lambda: f.color_name(),
            r'image|photo|avatar|picture': lambda: f.image_url(),
            r'^is_|^has_|^can_|active|enabled|verified|confirmed':
                lambda: f.boolean(),
        }

        self.TYPE_MAPPERS = {
            'UUID': lambda: str(uuid4()),
            'GUID': lambda: str(uuid4()),
            'UNIQUEIDENTIFIER': lambda: str(uuid4()),
            'INT': lambda: f.random_int(
                min=MOCK_DATA_INT_MIN, max=MOCK_DATA_INT_MAX
            ),
            'INTEGER': lambda: f.random_int(
                min=MOCK_DATA_INT_MIN, max=MOCK_DATA_INT_MAX
            ),
            'SMALLINT': lambda: f.random_int(
                min=MOCK_DATA_INT_MIN, max=MOCK_DATA_SMALLINT_MAX
            ),
            'BIGINT': lambda: f.random_int(
                min=MOCK_DATA_INT_MIN, max=MOCK_DATA_BIGINT_MAX
            ),
            'TINYINT': lambda: f.random_int(
                min=MOCK_DATA_INT_MIN, max=MOCK_DATA_TINYINT_MAX
            ),
            'SERIAL': lambda: f.random_int(
                min=MOCK_DATA_SERIAL_MIN, max=MOCK_DATA_INT_MAX
            ),
            'FLOAT': lambda: round(f.random.uniform(
                MOCK_DATA_FLOAT_MIN, MOCK_DATA_FLOAT_MAX
            ), 2),
            'DOUBLE': lambda: round(f.random.uniform(
                MOCK_DATA_FLOAT_MIN, MOCK_DATA_FLOAT_MAX
            ), 2),
            'DECIMAL': lambda: round(f.random.uniform(
                MOCK_DATA_FLOAT_MIN, MOCK_DATA_FLOAT_MAX
            ), 2),
            'NUMERIC': lambda: round(f.random.uniform(
                MOCK_DATA_FLOAT_MIN, MOCK_DATA_FLOAT_MAX
            ), 2),
            'REAL': lambda: round(f.random.uniform(
                MOCK_DATA_FLOAT_MIN, MOCK_DATA_FLOAT_MAX
            ), 2),
            'MONEY': lambda: round(f.random.uniform(
                MOCK_DATA_FLOAT_MIN, MOCK_DATA_MONEY_MAX
            ), 2),
            'BOOL': lambda: f.boolean(),
            'BOOLEAN': lambda: f.boolean(),
            'BIT': lambda: f.boolean(),
            'DATE': lambda: f.date_this_year().isoformat(),
            'TIME': lambda: f.time(),
            'TIMESTAMP': lambda: f.date_time_this_year().isoformat(),
            'DATETIME': lambda: f.date_time_this_year().isoformat(),
            'TEXT': lambda: f.paragraph(
                nb_sentences=MOCK_DATA_TEXT_SHORT_SENTENCES
            ),
            'LONGTEXT': lambda: f.paragraph(
                nb_sentences=MOCK_DATA_TEXT_LONG_SENTENCES
            ),
            'MEDIUMTEXT': lambda: f.paragraph(
                nb_sentences=MOCK_DATA_TEXT_SHORT_SENTENCES
            ),
            'CLOB': lambda: f.paragraph(
                nb_sentences=MOCK_DATA_TEXT_SHORT_SENTENCES
            ),
            'JSON': lambda: f.json(),
            'JSONB': lambda: f.json(),
            'BLOB': lambda: f.binary(length=MOCK_DATA_BINARY_LENGTH),
            'BINARY': lambda: f.binary(length=MOCK_DATA_BINARY_LENGTH),
            'VARBINARY': lambda: f.binary(length=MOCK_DATA_BINARY_LENGTH),
            'BYTEA': lambda: f.binary(length=MOCK_DATA_BINARY_LENGTH),
            'ENUM': lambda: f.word(),
        }

    def generate(
        self,
        columns: List[Dict[str, Any]],
        count: int
    ) -> List[Dict[str, Any]]:
        results = []
        for i in range(count):
            row = {}
            for col in columns:
                col_name = col.get('name', '')
                col_type = col.get('type', '')
                is_pk = col.get('is_pk', False)
                row[col_name] = self._get_value(col_name, col_type, is_pk, i)
            results.append(row)
        return results

    def generate_with_fk(
        self,
        table_name: str,
        schema_json: Dict[str, Any],
        count: int,
        recursion_depth: int = 0
    ) -> List[Dict[str, Any]]:
        if recursion_depth > MOCK_DATA_RECURSION_MAX_DEPTH:
            logger.warning(
                f"Max recursion depth reached for {table_name}. "
                f"Skipping FK auto-generation."
            )
            return []

        logger.info(
            f"Generating {count} rows for '{table_name}' "
            f"(depth: {recursion_depth})"
        )

        target_table = next(
            (t for t in schema_json.get('tables', [])
             if t['name'] == table_name),
            None
        )
        if not target_table:
            raise ValueError(f"Table {table_name} not found in schema")

        columns = target_table.get('columns', [])
        foreign_keys = target_table.get('foreign_keys', [])

        logger.info(
            f"Table has {len(columns)} columns, {len(foreign_keys)} FKs"
        )

        fk_pools = {}
        for fk in foreign_keys:
            col_name = fk['column']
            ref_table_name = fk['ref_table']
            ref_col_name = fk['ref_column']

            logger.info(
                f"FK: {col_name} -> {ref_table_name}.{ref_col_name}"
            )

            parent_table = next(
                (t for t in schema_json.get('tables', [])
                 if t['name'] == ref_table_name),
                None
            )

            valid_values = []
            if parent_table:
                sample_data = parent_table.get('sample_data', [])

                if not sample_data:
                    logger.info(
                        f"  Parent '{ref_table_name}' is empty. "
                        f"Auto-generating data..."
                    )

                    parent_rows = self.generate_with_fk(
                        table_name=ref_table_name,
                        schema_json=schema_json,
                        count=MOCK_DATA_AUTO_PARENT_ROWS,
                        recursion_depth=recursion_depth + 1
                    )

                    if parent_rows:
                        if 'sample_data' not in parent_table:
                            parent_table['sample_data'] = []
                        parent_table['sample_data'].extend(parent_rows)

                        logger.info(
                            f"  Generated {len(parent_rows)} rows for "
                            f"'{ref_table_name}'"
                        )

                        sample_data = parent_table['sample_data']

                if sample_data:
                    for row in sample_data:
                        value = row.get(ref_col_name)
                        if value is not None:
                            valid_values.append(value)

                    logger.info(
                        f"  Collected {len(valid_values)} valid FK values"
                    )
            else:
                logger.warning(
                    f"  Parent table '{ref_table_name}' not found!"
                )

            fk_pools[col_name] = valid_values

        results = []
        for i in range(count):
            row = {}
            for col in columns:
                col_name = col['name']
                col_type = col['type']
                is_pk = col.get('is_pk', False)

                if col_name in fk_pools:
                    options = fk_pools[col_name]
                    if options:
                        row[col_name] = random.choice(options)
                    else:
                        logger.warning(
                            f"No FK data for {col_name}, using fallback"
                        )
                        row[col_name] = self._get_value(
                            col_name, col_type, is_pk, i
                        )
                elif is_pk:
                    row[col_name] = self._handle_primary_key(col_type, i)
                else:
                    row[col_name] = self._get_value(
                        col_name, col_type, is_pk, i
                    )

            results.append(row)

        return results

    def _get_value(
        self,
        name: str,
        dtype: str,
        is_pk: bool = False,
        index: int = 0
    ) -> Any:
        if is_pk:
            return self._handle_primary_key(dtype, index)

        name_lower = name.lower()
        base_type, length = self._parse_sql_type(dtype)

        for pattern, provider in self.NAME_PATTERNS.items():
            if re.search(pattern, name_lower):
                val = provider()
                if isinstance(val, str) and length and len(val) > length:
                    return val[:length]
                return val

        if base_type in ['VARCHAR', 'CHAR', 'NVARCHAR', 'STRING']:
            if length and length < MOCK_DATA_VARCHAR_SHORT_THRESHOLD:
                return self.faker.lexify('?' * min(length, 20))
            max_chars = min(
                length or MOCK_DATA_VARCHAR_DEFAULT_MAX,
                MOCK_DATA_VARCHAR_ABSOLUTE_MAX
            )
            text = self.faker.text(max_nb_chars=max_chars)
            return text[:length] if length else text

        if base_type in self.TYPE_MAPPERS:
            return self.TYPE_MAPPERS[base_type]()

        return self.faker.word()

    def _handle_primary_key(self, dtype: str, index: int) -> Any:
        dtype_upper = dtype.upper()
        if 'UUID' in dtype_upper or 'GUID' in dtype_upper:
            return str(uuid4())
        elif any(t in dtype_upper for t in ['INT', 'SERIAL', 'BIGINT']):
            return index + 1
        else:
            return str(uuid4())

    @staticmethod
    def _parse_sql_type(raw_type: str) -> Tuple[str, Optional[int]]:
        raw_type = raw_type.upper().strip()
        match = re.match(r'^([A-Z]+)(?:\((\d+)\))?', raw_type)
        if match:
            base = match.group(1)
            length = int(match.group(2)) if match.group(2) else None
            return base, length
        return raw_type, None
