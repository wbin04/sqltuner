import re


def convert_copy_to_insert(sql_file_path, output_file_path):
    with open(sql_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')

    output_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith('COPY '):
            match = re.match(
                r'COPY (\w+)\.(\w+) \(([^)]+)\) FROM stdin;',
                line
            )
            if match:
                schema = match.group(1)
                table = match.group(2)
                columns = [col.strip() for col in match.group(3).split(',')]
                i += 1
                data_lines = []
                while i < len(lines) and lines[i] != '\\.':
                    data_lines.append(lines[i])
                    i += 1

                for data_line in data_lines:
                    if data_line.strip() == '':
                        continue
                    values = data_line.split('\t')
                    if len(values) != len(columns):
                        print(f"Warning: column count mismatch for {table}")
                        continue
                    formatted_values = []
                    for val in values:
                        if val == '\\N':
                            formatted_values.append('NULL')
                        else:
                            escaped = val.replace("'", "''")
                            formatted_values.append(f"'{escaped}'")
                    insert = f"INSERT INTO {schema}.{table} "
                    f"({', '.join(columns)}) "
                    f"VALUES ({', '.join(formatted_values)});"
                    output_lines.append(insert)
            else:
                output_lines.append(line)
        else:
            output_lines.append(line)
        i += 1

    with open(output_file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(output_lines))


if __name__ == '__main__':
    convert_copy_to_insert(
        r'c:\Users\USER\Downloads\sqltuner_db_2026-02-01_204414.sql',
        r'c:\Users\USER\Desktop\sqltuner\converted.sql'
    )
