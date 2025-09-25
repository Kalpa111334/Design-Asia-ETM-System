-- ================================================================================================
-- COMPLETE TASK DELETION CONSTRAINTS
-- ================================================================================================
-- This SQL file ensures that all foreign key constraints are properly set up to handle
-- task deletion with appropriate CASCADE or SET NULL behaviors.
-- 
-- Run this script in your Supabase SQL Editor to ensure referential integrity.
-- ================================================================================================

-- 1. TASK ATTACHMENTS (should CASCADE)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_attachments_task_id_fkey'
    ) THEN
        ALTER TABLE task_attachments DROP CONSTRAINT task_attachments_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE task_attachments 
    ADD CONSTRAINT task_attachments_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated task_attachments foreign key constraint';
END $$;

-- 2. TASK ASSIGNEES (should CASCADE)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_assignees_task_id_fkey'
    ) THEN
        ALTER TABLE task_assignees DROP CONSTRAINT task_assignees_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE task_assignees 
    ADD CONSTRAINT task_assignees_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated task_assignees foreign key constraint';
END $$;

-- 3. TASK PROOFS (should CASCADE)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_proofs_task_id_fkey'
    ) THEN
        ALTER TABLE task_proofs DROP CONSTRAINT task_proofs_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE task_proofs 
    ADD CONSTRAINT task_proofs_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated task_proofs foreign key constraint';
END $$;

-- 4. TIME LOGS (should CASCADE)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'time_logs_task_id_fkey'
    ) THEN
        ALTER TABLE time_logs DROP CONSTRAINT time_logs_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE time_logs 
    ADD CONSTRAINT time_logs_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated time_logs foreign key constraint';
END $$;

-- 5. TASK EVENTS (should CASCADE)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_events_task_id_fkey'
    ) THEN
        ALTER TABLE task_events DROP CONSTRAINT task_events_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE task_events 
    ADD CONSTRAINT task_events_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated task_events foreign key constraint';
END $$;

-- 6. TASK LOCATIONS (should CASCADE)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_locations_task_id_fkey'
    ) THEN
        ALTER TABLE task_locations DROP CONSTRAINT task_locations_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE task_locations 
    ADD CONSTRAINT task_locations_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated task_locations foreign key constraint';
END $$;

-- 7. TASK LOCATION EVENTS (should CASCADE)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'task_location_events_task_id_fkey'
    ) THEN
        ALTER TABLE task_location_events DROP CONSTRAINT task_location_events_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE task_location_events 
    ADD CONSTRAINT task_location_events_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated task_location_events foreign key constraint';
END $$;

-- 8. LOCATION ALERTS (should CASCADE when task_id is not null)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'location_alerts_task_id_fkey'
    ) THEN
        ALTER TABLE location_alerts DROP CONSTRAINT location_alerts_task_id_fkey;
    END IF;
    
    -- Add constraint with CASCADE
    ALTER TABLE location_alerts 
    ADD CONSTRAINT location_alerts_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Updated location_alerts foreign key constraint';
END $$;

-- 9. EMPLOYEE LOCATIONS (should SET NULL - location tracking continues without task reference)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'employee_locations_task_id_fkey'
    ) THEN
        ALTER TABLE employee_locations DROP CONSTRAINT employee_locations_task_id_fkey;
    END IF;
    
    -- Add constraint with SET NULL
    ALTER TABLE employee_locations 
    ADD CONSTRAINT employee_locations_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Updated employee_locations foreign key constraint';
END $$;

-- 10. EMPLOYEE MOVEMENT HISTORY (should SET NULL - movement history is preserved)
-- ================================================================================================
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'employee_movement_history_task_id_fkey'
    ) THEN
        ALTER TABLE employee_movement_history DROP CONSTRAINT employee_movement_history_task_id_fkey;
    END IF;
    
    -- Add constraint with SET NULL
    ALTER TABLE employee_movement_history 
    ADD CONSTRAINT employee_movement_history_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Updated employee_movement_history foreign key constraint';
END $$;

-- 11. JOBS TABLE REFERENCE (tasks can reference jobs, but job deletion doesn't delete tasks)
-- ================================================================================================
DO $$
BEGIN
    -- Check if job_id column exists in tasks table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'job_id'
    ) THEN
        -- Drop existing constraint if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'tasks_job_id_fkey'
        ) THEN
            ALTER TABLE tasks DROP CONSTRAINT tasks_job_id_fkey;
        END IF;
        
        -- Add constraint with SET NULL (tasks can exist without jobs)
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_job_id_fkey 
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Updated tasks job_id foreign key constraint';
    ELSE
        RAISE NOTICE 'job_id column does not exist in tasks table';
    END IF;
END $$;

-- ================================================================================================
-- VERIFICATION QUERIES
-- ================================================================================================
-- Run these queries to verify that all constraints are properly set up

-- Check all foreign key constraints related to tasks
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (ccu.table_name = 'tasks' OR tc.table_name LIKE '%task%')
ORDER BY tc.table_name, tc.constraint_name;

-- ================================================================================================
-- CLEANUP FUNCTIONS
-- ================================================================================================

-- Function to clean up any orphaned records (run manually if needed)
CREATE OR REPLACE FUNCTION cleanup_orphaned_task_data()
RETURNS TABLE(
    table_name TEXT,
    orphaned_count BIGINT,
    cleaned_up BOOLEAN
) AS $$
BEGIN
    -- This function identifies and optionally cleans up orphaned records
    -- that might exist due to previous incomplete deletions
    
    RAISE NOTICE 'Starting orphaned data cleanup check...';
    
    -- Check task_attachments
    RETURN QUERY
    SELECT 'task_attachments'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
    FROM task_attachments ta
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = ta.task_id);
    
    -- Check task_assignees
    RETURN QUERY
    SELECT 'task_assignees'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
    FROM task_assignees ta
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = ta.task_id);
    
    -- Check task_proofs
    RETURN QUERY
    SELECT 'task_proofs'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
    FROM task_proofs tp
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tp.task_id);
    
    -- Check time_logs
    RETURN QUERY
    SELECT 'time_logs'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
    FROM time_logs tl
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tl.task_id);
    
    -- Check task_events (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_events') THEN
        RETURN QUERY
        SELECT 'task_events'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
        FROM task_events te
        WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = te.task_id);
    END IF;
    
    -- Check task_locations (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_locations') THEN
        RETURN QUERY
        SELECT 'task_locations'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
        FROM task_locations tl
        WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tl.task_id);
    END IF;
    
    -- Check task_location_events (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_location_events') THEN
        RETURN QUERY
        SELECT 'task_location_events'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
        FROM task_location_events tle
        WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tle.task_id);
    END IF;
    
    -- Check location_alerts (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'location_alerts') THEN
        RETURN QUERY
        SELECT 'location_alerts'::TEXT, COUNT(*)::BIGINT, FALSE::BOOLEAN
        FROM location_alerts la
        WHERE la.task_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = la.task_id);
    END IF;
    
    RAISE NOTICE 'Orphaned data check completed. Review results and run cleanup_orphaned_task_data_execute() if needed.';
END;
$$ LANGUAGE plpgsql;

-- Function to actually execute the cleanup (DANGEROUS - use with caution)
CREATE OR REPLACE FUNCTION cleanup_orphaned_task_data_execute()
RETURNS TABLE(
    table_name TEXT,
    records_deleted BIGINT
) AS $$
DECLARE
    deleted_count BIGINT;
BEGIN
    RAISE WARNING 'EXECUTING ORPHANED DATA CLEANUP - THIS WILL PERMANENTLY DELETE DATA!';
    
    -- Clean task_attachments
    DELETE FROM task_attachments ta
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = ta.task_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'task_attachments'::TEXT, deleted_count;
    
    -- Clean task_assignees
    DELETE FROM task_assignees ta
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = ta.task_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'task_assignees'::TEXT, deleted_count;
    
    -- Clean task_proofs
    DELETE FROM task_proofs tp
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tp.task_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'task_proofs'::TEXT, deleted_count;
    
    -- Clean time_logs
    DELETE FROM time_logs tl
    WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tl.task_id);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN QUERY SELECT 'time_logs'::TEXT, deleted_count;
    
    -- Clean task_events (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_events') THEN
        DELETE FROM task_events te
        WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = te.task_id);
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN QUERY SELECT 'task_events'::TEXT, deleted_count;
    END IF;
    
    -- Clean task_locations (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_locations') THEN
        DELETE FROM task_locations tl
        WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tl.task_id);
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN QUERY SELECT 'task_locations'::TEXT, deleted_count;
    END IF;
    
    -- Clean task_location_events (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_location_events') THEN
        DELETE FROM task_location_events tle
        WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = tle.task_id);
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN QUERY SELECT 'task_location_events'::TEXT, deleted_count;
    END IF;
    
    -- Clean location_alerts (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'location_alerts') THEN
        DELETE FROM location_alerts la
        WHERE la.task_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = la.task_id);
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN QUERY SELECT 'location_alerts'::TEXT, deleted_count;
    END IF;
    
    RAISE NOTICE 'Orphaned data cleanup completed.';
END;
$$ LANGUAGE plpgsql;

-- ================================================================================================
-- USAGE INSTRUCTIONS
-- ================================================================================================
/*

1. Run this entire script in your Supabase SQL Editor to set up proper foreign key constraints.

2. To check for orphaned data (without deleting):
   SELECT * FROM cleanup_orphaned_task_data();

3. To actually clean up orphaned data (DANGEROUS):
   SELECT * FROM cleanup_orphaned_task_data_execute();

4. To verify constraints are set up correctly:
   Run the verification query included in this script.

5. The TaskDeletionService in the application will now work with these constraints
   to ensure complete and proper deletion of tasks and all related data.

*/
