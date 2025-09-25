// Test script for auto-forwarding functionality
import { TaskAutoForwardingService } from './services/TaskAutoForwardingService';

async function testAutoForwarding() {
  console.log('Testing Task Auto-Forwarding Service...');
  
  try {
    // Test 1: Get statistics
    console.log('\n1. Testing getTaskForwardingStats...');
    const stats = await TaskAutoForwardingService.getTaskForwardingStats();
    console.log('Stats:', stats);
    
    // Test 2: Get planned tasks
    console.log('\n2. Testing getAllPlannedTasks...');
    const plannedTasks = await TaskAutoForwardingService.getAllPlannedTasks();
    console.log('Planned tasks:', plannedTasks.data?.length || 0);
    
    // Test 3: Get pending tasks
    console.log('\n3. Testing getAllPendingTasks...');
    const pendingTasks = await TaskAutoForwardingService.getAllPendingTasks();
    console.log('Pending tasks:', pendingTasks.data?.length || 0);
    
    // Test 4: Manual forward (if there are planned tasks)
    if (plannedTasks.data && plannedTasks.data.length > 0) {
      console.log('\n4. Testing manual forward...');
      const forwardResult = await TaskAutoForwardingService.forwardExpectedTasks();
      console.log('Forward result:', forwardResult);
    } else {
      console.log('\n4. No planned tasks to forward');
    }
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  testAutoForwarding();
}

export { testAutoForwarding };
