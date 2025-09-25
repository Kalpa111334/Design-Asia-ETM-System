# Task Auto-Forwarding Feature

## Overview
This feature automatically forwards incomplete "Expected" tasks to "Pending" status when they pass their due date, ensuring that overdue tasks are properly tracked and visible to both employees and administrators.

## Features Implemented

### 1. New Task Statuses
- **Expected**: Tasks that are scheduled for a future date
- **Pending**: Tasks that were automatically forwarded from Expected status when they passed their due date

### 2. Database Changes
- Added new statuses to the tasks table constraint
- Added `forwarded_at` column to track when a task was forwarded
- Added `original_due_date` column to preserve the original due date
- Created `auto_forward_expected_tasks()` function for automatic forwarding
- Added performance index for efficient querying

### 3. Auto-Forwarding Logic
- **Automatic**: Runs every hour via the `TaskAutoForwarder` component
- **Manual**: Admins can trigger forwarding via the "Forward to Pending" button
- **Smart**: Only forwards tasks that are past their due date
- **Preserves History**: Keeps track of original due date and forwarding timestamp

### 4. Dashboard Updates

#### Employee Dashboard
- Shows "Pending Tasks" section when there are forwarded tasks
- Displays original due date for context
- Clear visual indication that these are auto-forwarded tasks
- Tasks appear in orange styling to indicate urgency

#### Admin Dashboard
- Shows both "Expected Tasks" and "Pending Tasks" sections
- Manual "Forward to Pending" button for immediate action
- Real-time visibility of all task statuses
- Employee assignment information for each task

### 5. Task Creation
- Enhanced task creation form with status selection
- Default status set to "Expected" for new tasks
- Admins can create tasks in any status as needed

### 6. Task Management
- Updated task filtering to exclude Expected tasks from active view
- Proper status color coding for all new statuses
- Action buttons respect the new status workflow

## Technical Implementation

### Files Modified/Created

#### New Files
- `src/services/TaskAutoForwardingService.ts` - Core service for auto-forwarding logic
- `src/components/TaskAutoForwarder.tsx` - Background component for automatic forwarding
- `supabase/migrations/20250103000000_add_expected_pending_statuses.sql` - Database migration

#### Modified Files
- `src/types/index.ts` - Added new statuses and fields to Task interface
- `src/pages/employee/Dashboard.tsx` - Added Pending Tasks section
- `src/pages/admin/Dashboard.tsx` - Added Expected and Pending Tasks sections
- `src/components/admin/EnhancedTaskForm.tsx` - Added status selection field
- `src/pages/employee/Tasks.tsx` - Updated status handling and filtering
- `src/App.tsx` - Added TaskAutoForwarder component

### Database Schema Changes

```sql
-- New statuses added to tasks table
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('Expected', 'Not Started', 'In Progress', 'Paused', 'Completed', 'Pending'));

-- New columns for tracking
ALTER TABLE public.tasks 
ADD COLUMN forwarded_at timestamp with time zone;
ALTER TABLE public.tasks 
ADD COLUMN original_due_date timestamp with time zone;
```

### Service API

The `TaskAutoForwardingService` provides these methods:

- `forwardExpectedTasks()` - Manually trigger forwarding
- `getPendingTasksForUser(userId)` - Get pending tasks for a specific employee
- `getAllPendingTasks()` - Get all pending tasks (admin view)
- `getAllExpectedTasks()` - Get all expected tasks (admin view)
- `createExpectedTask(taskData)` - Create a task with Expected status
- `movePendingToExpected(taskId)` - Move a pending task back to expected
- `getTaskForwardingStats()` - Get statistics about task forwarding

## Usage

### For Employees
1. Login to the employee dashboard
2. View "Pending Tasks" section for auto-forwarded tasks
3. These tasks require immediate attention as they were due yesterday
4. Start working on pending tasks as normal

### For Administrators
1. Login to the admin dashboard
2. View "Expected Tasks" section to see scheduled tasks
3. Use "Forward to Pending" button to manually trigger forwarding
4. View "Pending Tasks" section to see auto-forwarded tasks
5. Monitor task completion and employee workload

### Creating Tasks
1. Go to Admin > Create Task
2. Select "Expected" status for future-dated tasks
3. Select other statuses as needed for immediate tasks
4. Tasks with "Expected" status will be automatically forwarded when overdue

## Benefits

1. **Automatic Workflow**: No manual intervention needed for overdue tasks
2. **Real-time Visibility**: Both employees and admins see forwarded tasks immediately
3. **Historical Tracking**: Original due dates are preserved for reporting
4. **Flexible Management**: Admins can override the automatic process
5. **Clear Status Progression**: Expected → Pending → In Progress → Completed

## Future Enhancements

1. **Email Notifications**: Send notifications when tasks are forwarded
2. **Scheduled Jobs**: Use pg_cron for more reliable scheduling
3. **Custom Rules**: Allow different forwarding rules per task type
4. **Reporting**: Add reports for task forwarding statistics
5. **Mobile Notifications**: Push notifications for pending tasks

## Testing

Use the test script to verify functionality:

```typescript
import { testAutoForwarding } from './src/test-auto-forwarding';
testAutoForwarding();
```

This will test all the service methods and verify the auto-forwarding logic works correctly.
