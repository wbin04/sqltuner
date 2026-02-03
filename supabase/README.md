# Supabase cmd

```cmd
npx supabase migration new truncate_data
npx supabase migration new import_docker_data

docker exec -i sqltuner_database pg_dump -U postgres -d sqltuner_db -a --column-inserts --no-owner --no-privileges | findstr /V /B /C:"\\restrict" /C:"\\unrestrict" > supabase\migrations\{id}_import_docker_data.sql

npx supabase db push
```

## Truncate data

```sql
SET session_replication_role = 'replica';

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE "public"."' || r.tablename || '" RESTART IDENTITY CASCADE';
    END LOOP;
END $$;

SET session_replication_role = 'origin';
```