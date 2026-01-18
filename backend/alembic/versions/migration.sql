-- =====================================================
-- SQL Migration Script: Add Simulation Support
-- =====================================================
-- This script migrates db_connections table to support 
-- both Real Database Connections and Virtual Simulations
-- =====================================================

-- STEP 1: Add 'simulation' value to db_type enum
-- Note: PostgreSQL requires special handling for enum types
ALTER TYPE db_type ADD VALUE IF NOT EXISTS 'simulation';

-- STEP 2: Add meta_schema column (JSONB)
-- This column stores the unified schema metadata for both real and simulation connections
ALTER TABLE db_connections 
ADD COLUMN IF NOT EXISTS meta_schema JSONB DEFAULT '{}'::jsonb;

-- STEP 3: Make connection fields NULLABLE
-- Simulation connections don't need actual database credentials
ALTER TABLE db_connections 
ALTER COLUMN host DROP NOT NULL;

ALTER TABLE db_connections 
ALTER COLUMN db_password DROP NOT NULL;

ALTER TABLE db_connections 
ALTER COLUMN db_name DROP NOT NULL;

-- STEP 4: Add comments for documentation
COMMENT ON COLUMN db_connections.meta_schema IS 
'Unified schema storage: Cache for real DBs, source-of-truth for simulations. Stores tables, columns, types, foreign keys as JSON.';

COMMENT ON COLUMN db_connections.host IS 
'Database host (required for real connections, NULL for simulations)';

COMMENT ON COLUMN db_connections.db_password IS 
'Encrypted database password (required for real connections, NULL for simulations)';

COMMENT ON COLUMN db_connections.db_name IS 
'Database name (required for real connections, NULL for simulations)';

-- STEP 5: Create index on db_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_db_connections_db_type 
ON db_connections(db_type);

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- Note: PostgreSQL does not support removing enum values
-- To rollback, you would need to:
-- 1. Remove all rows with db_type = 'simulation'
-- 2. Recreate the enum type without 'simulation'
-- 3. Drop meta_schema column
-- 4. Set columns back to NOT NULL

-- Example rollback (use with caution):
/*
-- Remove simulation connections
DELETE FROM db_connections WHERE db_type = 'simulation';

-- Drop index
DROP INDEX IF EXISTS idx_db_connections_db_type;

-- Drop meta_schema column
ALTER TABLE db_connections DROP COLUMN IF EXISTS meta_schema;

-- Make fields NOT NULL again (will fail if any NULL values exist)
ALTER TABLE db_connections ALTER COLUMN host SET NOT NULL;
ALTER TABLE db_connections ALTER COLUMN db_password SET NOT NULL;
ALTER TABLE db_connections ALTER COLUMN db_name SET NOT NULL;
*/
