# Multi-Assignment Attachment Visibility Fix

## Problem Description

When an admin assigns a task to multiple employees at the same time, the task should be updated and visible to all of them on their employee pages. However, with attachments, it wasn't working correctly. Specifically:

1. **Task Creation**: Tasks were being created correctly with multiple assignments via the `task_assignees` table
2. **Attachment Upload**: Attachments were being uploaded and stored correctly
3. **Visibility Issue**: Employees assigned via `task_assignees` table could not see the attachments due to incorrect RLS (Row Level Security) policies

## Root Cause Analysis

The issue was in the RLS policies for the `task_attachments` table. The original policy only checked for direct assignment:

```sql
-- OLD POLICY (INCORRECT)
CREATE POLICY "Users can view attachments for their assigned tasks"
    ON public.task_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_id
            AND tasks.assigned_to = auth.uid()  -- Only checks direct assignment
        )
    );
```

This policy did not account for tasks assigned via the `task_assignees` table, which is used for multi-employee assignments.

## Solution Overview

The fix involves two main components:

### 1. Updated RLS Policies (`FIX_MULTI_ASSIGN_ATTACHMENT_VISIBILITY.sql`)

Updated the RLS policies to check both direct assignment (`tasks.assigned_to`) and multi-assignment (`task_assignees` table):

```sql
-- NEW POLICY (CORRECT)
CREATE POLICY "Users can view attachments for assigned tasks"
    ON public.task_attachments FOR SELECT
    TO authenticated
    USING (
        -- Direct assignment via tasks.assigned_to
        EXISTS (
            SELECT 1 FROM public.tasks
            WHERE tasks.id = task_attachments.task_id
            AND tasks.assigned_to = auth.uid()
        )
        OR
        -- Multi-assignment via task_assignees table
        EXISTS (
            SELECT 1 FROM public.task_assignees ta
            WHERE ta.task_id = task_attachments.task_id
            AND ta.user_id = auth.uid()
        )
    );
```

### 2. Improved Frontend Task Fetching Logic

Updated both `src/pages/employee/Tasks.tsx` and `src/pages/employee/Dashboard.tsx` to use more robust task fetching logic with multiple fallback methods:

1. **Primary Method**: Use `v_user_tasks` view if available
2. **Secondary Method**: Fetch direct tasks and multi-assigned tasks separately and combine them
3. **Fallback Method**: Get all task IDs from both sources and fetch complete task data with attachments

## Files Modified

### Database/SQL Files
- `FIX_MULTI_ASSIGN_ATTACHMENT_VISIBILITY.sql` - Main fix for RLS policies
- `TEST_MULTI_ASSIGN_ATTACHMENT_FIX.sql` - Comprehensive test script

### Frontend Files
- `src/pages/employee/Tasks.tsx` - Improved task fetching logic
- `src/pages/employee/Dashboard.tsx` - Improved task fetching logic

## Implementation Steps

### 1. Apply Database Fix

Run the RLS policy fix in your Supabase SQL editor:

```bash
# In Supabase SQL Editor, run:
FIX_MULTI_ASSIGN_ATTACHMENT_VISIBILITY.sql
```

### 2. Test the Fix

Run the comprehensive test to verify everything works:

```bash
# In Supabase SQL Editor, run:
TEST_MULTI_ASSIGN_ATTACHMENT_FIX.sql
```

### 3. Deploy Frontend Changes

The frontend changes are already applied to:
- `src/pages/employee/Tasks.tsx`
- `src/pages/employee/Dashboard.tsx`

## Verification Steps

1. **Create a multi-assigned task**:
   - Admin creates a task
   - Assigns it to multiple employees via the multi-select dropdown
   - Adds attachments to the task

2. **Check employee visibility**:
   - Each assigned employee should see the task in their Tasks page
   - Each assigned employee should see all attachments when clicking "View Attachments"
   - Task should appear in their Dashboard statistics

3. **Test with different scenarios**:
   - Tasks with only direct assignment (`tasks.assigned_to`)
   - Tasks with only multi-assignment (`task_assignees` table)
   - Tasks with both direct and multi-assignment
   - Tasks with multiple attachments

## Technical Details

### RLS Policy Logic

The new RLS policies check for task visibility using an OR condition:

1. **Direct Assignment**: `tasks.assigned_to = auth.uid()`
2. **Multi-Assignment**: EXISTS check in `task_assignees` table

This ensures that employees can see attachments for tasks assigned to them through either method.

### Frontend Query Strategy

The improved frontend logic uses a three-tier approach:

1. **View-based Query**: Attempts to use `v_user_tasks` view for optimal performance
2. **Separate Queries**: Falls back to separate queries for direct and multi-assigned tasks
3. **ID-based Fallback**: As a last resort, gets all task IDs and fetches complete data

### Performance Considerations

- The OR condition in RLS policies may have a slight performance impact
- The frontend uses efficient Map-based deduplication to avoid duplicate tasks
- Fallback queries are only used when primary methods fail

## Testing

The `TEST_MULTI_ASSIGN_ATTACHMENT_FIX.sql` script provides comprehensive testing:

1. Creates test scenario with multi-assigned task and attachments
2. Verifies RLS policy behavior for each assigned employee
3. Tests the `v_user_tasks` view functionality
4. Simulates frontend queries
5. Provides cleanup option

## Troubleshooting

### Common Issues

1. **Attachments still not visible**:
   - Check if RLS policies were applied correctly
   - Verify the `task_assignees` table has the correct records
   - Check browser console for any JavaScript errors

2. **Tasks not appearing**:
   - Verify the `v_user_tasks` view exists and is accessible
   - Check if the fallback query logic is working
   - Ensure the user has the correct permissions

3. **Performance issues**:
   - Consider adding indexes on frequently queried columns
   - Monitor query performance in Supabase dashboard
   - Consider caching strategies for frequently accessed data

### Debug Information

The updated frontend code includes extensive console logging:
- `🔍 DEBUG:` - General debugging information
- `🔍 DASHBOARD DEBUG:` - Dashboard-specific debugging

Check the browser console for detailed information about query execution and results.

## Future Improvements

1. **Caching**: Implement caching for frequently accessed task and attachment data
2. **Indexes**: Add database indexes for optimal query performance
3. **Real-time Updates**: Consider implementing real-time updates for task assignments
4. **Batch Operations**: Optimize bulk operations for better performance

## Summary

This fix ensures that when an admin assigns a task to multiple employees, all assigned employees can see the task and its attachments correctly. The solution addresses both the database-level RLS policies and the frontend query logic to provide a comprehensive fix for the multi-assignment attachment visibility issue.