import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { User } from '../../types/index';
import toast from 'react-hot-toast';
import { ChatIcon, TrashIcon, ArchiveIcon, PlusIcon, PencilIcon, ViewGridIcon, ViewListIcon, UserGroupIcon, CalendarIcon, ShieldCheckIcon } from '@heroicons/react/outline';
import DirectMessageModal from '../../components/DirectMessageModal';
import DeletedUsersModal from '../../components/DeletedUsersModal';
import EmployeeForm from '../../components/admin/EmployeeForm';
import { EmployeeService, CreateEmployeeData, UpdateEmployeeData } from '../../services/EmployeeService';
import { withPermission } from '../../components/withPermission';
import { LoginPinService, LoginPinRecord } from '../../services/LoginPinService';

function Team() {
  const [team, setTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletedUsersModalOpen, setIsDeletedUsersModalOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [pendingPins, setPendingPins] = useState<LoginPinRecord[]>([]);
  const [recentPins, setRecentPins] = useState<any[]>([]);
  const [pinFilter, setPinFilter] = useState<'all' | 'approved' | 'rejected' | 'expired'>('all');
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    fetchTeam();
    document.title = 'Employee Management - TaskVision';
    const ch = supabase
      .channel('login-pin-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'login_pins' }, () => { fetchPendingPins(); fetchRecentPins(); })
      .subscribe();
    fetchPendingPins();
    fetchRecentPins();
    const intId = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, []);

  async function fetchTeam() {
    try {
      setLoading(true);
      // First check if the current user is an admin
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Check admin status using auth metadata first (more reliable)
      const role = user.user_metadata?.role || 'employee';
      console.log('User role from auth metadata:', role);
      
      if (role !== 'admin') {
        throw new Error('Only administrators can view team members');
      }

      // Try to get user from public.users table, but don't fail if it doesn't exist
      try {
        const { data: currentUser, error: currentUserError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (currentUserError && currentUserError.code !== 'PGRST116') {
          console.warn('Error checking user in public.users:', currentUserError);
        } else if (currentUser && currentUser.role !== 'admin') {
          console.warn('Role mismatch: auth metadata says admin but public.users says:', currentUser.role);
        }
      } catch (error) {
        console.warn('Could not verify user in public.users table:', error);
      }

      // Fetch active users (not deleted)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching team:', error);
        if (error.code === '42501') {
          throw new Error('You do not have permission to view team members');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      setTeam(data || []);
    } catch (error: any) {
      console.error('Error fetching team:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to fetch team members';
      
      if (error.message?.includes('relation "users" does not exist')) {
        errorMessage = 'Users table not found. Please run database migrations.';
      } else if (error.message?.includes('permission denied')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (error.message?.includes('Failed to verify admin status')) {
        errorMessage = 'Admin verification failed. Please try logging out and back in.';
      } else if (error.message?.includes('Database error')) {
        errorMessage = `Database error: ${error.message.split('Database error: ')[1]}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingPins() {
    try {
      const { data, error } = await supabase
        .from('login_pins')
        .select('*, users!login_pins_user_id_fkey(full_name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPendingPins((data || []) as any);
    } catch (e) {
      console.error('Error fetching pending pins:', e);
    }
  }

  async function fetchRecentPins() {
    try {
      const { data, error } = await supabase
        .from('login_pins')
        .select('id, user_id, status, approved_by, approved_at, created_at, users:users!login_pins_user_id_fkey(full_name, email), approver:users!login_pins_approved_by_fkey(full_name, email)')
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setRecentPins(data || []);
    } catch (e) {
      console.error('Error fetching recent pins:', e);
    }
  }

  async function approvePin(pinId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await LoginPinService.approvePin(pinId, user.id);
      if (error) throw error;
      toast.success('Login approved');
      fetchPendingPins();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to approve');
    }
  }

  async function rejectPin(pinId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await LoginPinService.rejectPin(pinId, user.id);
      if (error) throw error;
      toast.success('Login rejected');
      fetchPendingPins();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to reject');
    }
  }

  async function sendPin(userId: string) {
    try {
      const res = await LoginPinService.createPin(userId, 30);
      if (!res.success || !res.pin) throw new Error(res.error || 'Failed to create PIN');
      toast.success(`PIN sent. Expires in 30s`);
      fetchPendingPins();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to send PIN');
    }
  }

  function togglePinVisibility(pinId: string) {
    setVisiblePins(prev => ({ ...prev, [pinId]: !prev[pinId] }));
  }

  async function copyPin(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('PIN copied to clipboard');
    } catch {
      toast.error('Failed to copy PIN');
    }
  }

  function exportPinsCsv(rows: any[]) {
    const headers = ['Employee Name','Employee Email','Status','Approved By','Approved At','Created At'];
    const lines = [headers.join(',')];
    rows.forEach(r => {
      const line = [
        JSON.stringify(r.users?.full_name || ''),
        JSON.stringify(r.users?.email || ''),
        JSON.stringify(r.status || ''),
        JSON.stringify(r.approver?.full_name || ''),
        JSON.stringify(r.approved_at || ''),
        JSON.stringify(r.created_at || ''),
      ].join(',');
      lines.push(line);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pin-activity-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const handleMessageClick = (user: User) => {
    setSelectedUser(user);
    setIsMessageModalOpen(true);
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === team.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(team.map(user => user.id));
    }
  };

  const handleAddEmployee = () => {
    setFormMode('create');
    setEditingEmployee(null);
    setIsEmployeeFormOpen(true);
  };

  const handleEditEmployee = (employee: User) => {
    setFormMode('edit');
    setEditingEmployee(employee);
    setIsEmployeeFormOpen(true);
  };

  const handleEmployeeSubmit = async (data: CreateEmployeeData | UpdateEmployeeData) => {
    try {
      if (formMode === 'create') {
        const createData = data as CreateEmployeeData;
        const result = await EmployeeService.createEmployee(createData);
        
        if (result.success && result.user) {
          setTeam(prev => [result.user!, ...prev]);
          toast.success('Employee created successfully! They will receive a confirmation email and can log in after confirming their email.');
        } else {
          toast.error(result.error || 'Failed to create employee');
          throw new Error(result.error || 'Failed to create employee');
        }
      } else {
        const updateData = data as UpdateEmployeeData;
        if (!editingEmployee) {
          throw new Error('No employee selected for editing');
        }
        
        const result = await EmployeeService.updateEmployee(editingEmployee.id, updateData);
        
        if (result.success && result.user) {
          setTeam(prev => prev.map(emp => emp.id === editingEmployee.id ? result.user! : emp));
          toast.success('Employee updated successfully');
        } else {
          toast.error(result.error || 'Failed to update employee');
          throw new Error(result.error || 'Failed to update employee');
        }
      }
    } catch (error: any) {
      console.error('Error in employee submit:', error);
      throw error; // Re-throw to let the form handle it
    }
  };

  const handleDeleteSelected = async () => {
    try {
      if (!deletionReason.trim()) {
        toast.error('Please provide a reason for deletion');
        return;
      }

      // First check if the current user is an admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (currentUserError) {
        console.error('Error checking admin status:', currentUserError);
        throw new Error('Failed to verify admin status');
      }

      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Only administrators can delete team members');
      }

      // Set deletion reason for the trigger to use
      await supabase.rpc('set_deletion_reason', { reason: deletionReason });

      // Delete from users table - the trigger will handle inserting into deleted_users
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .in('id', selectedUsers);

      if (deleteError) {
        console.error('Error deleting users:', deleteError);
        if (deleteError.code === '42501') {
          throw new Error('You do not have permission to delete team members');
        }
        throw deleteError;
      }

      setSelectedUsers([]);
      setDeletionReason('');
      setIsDeleteModalOpen(false);
      
      toast.success('Selected team members have been permanently deleted');
      
      // Ensure we get fresh data after deletion
      await fetchTeam();
    } catch (error: any) {
      console.error('Error deleting team members:', error);
      toast.error(error.message || 'Failed to delete team members');
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="sm:flex-auto">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <UserGroupIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Employee Management
              </h1>
              <p className="mt-2 text-lg text-gray-600">
              Manage all active employees in your organization.
            </p>
          </div>
            {/* Pending PIN approvals */}
            <div className="w-full sm:w-auto">
              {pendingPins.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-yellow-800 mb-2">Pending Login Approvals ({pendingPins.length})</div>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {pendingPins.map((pin) => (
                      <div key={pin.id} className="flex items-center justify-between bg-white rounded border border-yellow-200 px-2 py-1">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{(pin as any).users?.full_name || 'Employee'}</div>
                          <div className="text-gray-500">{(pin as any).users?.email}</div>
                          <div className="text-gray-600 flex items-center gap-2">
                            <span>PIN:</span>
                            <span className="font-mono font-semibold tracking-widest">
                              {visiblePins[pin.id] ? pin.code : '••••••'}
                            </span>
                            <button
                              onClick={() => togglePinVisibility(pin.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                            >
                              {visiblePins[pin.id] ? 'Hide' : 'Show'}
                            </button>
                            {visiblePins[pin.id] && (
                              <button
                                onClick={() => copyPin(pin.code)}
                                className="text-xs text-gray-600 hover:text-gray-800 underline"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                          <div className="text-gray-400">
                            {(() => {
                              const remaining = Math.max(0, Math.ceil((new Date(pin.expires_at).getTime() - nowTick) / 1000));
                              return remaining > 0 ? `Expires in ${remaining}s` : 'Expired';
                            })()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approvePin(pin.id)} className="px-2 py-1 bg-green-600 text-white text-xs rounded">Approve</button>
                          <button onClick={() => rejectPin(pin.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:flex-none">
            <button
              onClick={handleAddEmployee}
                className="inline-flex items-center justify-center rounded-lg border border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-medium text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
            >
                <PlusIcon className="h-5 w-5 mr-2" />
              Add Employee
            </button>
            <button
              onClick={() => setIsDeletedUsersModalOpen(true)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200"
            >
                <ArchiveIcon className="h-5 w-5 mr-2" />
                View Deleted
            </button>
            {selectedUsers.length > 0 && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg border border-transparent bg-red-600 px-6 py-3 text-sm font-medium text-white shadow-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Delete ({selectedUsers.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-200">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Employees</p>
                  <p className="text-2xl font-bold text-gray-900">{team.length}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-200">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShieldCheckIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Admins</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {team.filter(member => member.role === 'admin').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-200">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {team.filter(member => {
                      const memberDate = new Date(member.created_at);
                      const now = new Date();
                      return memberDate.getMonth() === now.getMonth() && memberDate.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle and Controls */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="flex rounded-lg border border-gray-300 p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'cards'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ViewGridIcon className="h-4 w-4 mr-1" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ViewListIcon className="h-4 w-4 mr-1" />
                Table
              </button>
            </div>
          </div>
          
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
              <span>{selectedUsers.length} selected</span>
              <button
                onClick={() => setSelectedUsers([])}
                className="text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="mt-8">
          {/* Recent PIN activity */}
          {recentPins.length > 0 && (
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-800">Recent PIN Activity</div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {(['all','approved','rejected','expired'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setPinFilter(f)}
                        className={`px-2 py-0.5 text-xs rounded border ${pinFilter===f? 'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-700 border-gray-300'}`}
                      >
                        {f[0].toUpperCase()+f.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => exportPinsCsv(recentPins)}
                    className="px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {recentPins.filter(r => pinFilter==='all' ? true : r.status===pinFilter).map((r) => (
                  <div key={r.id} className="py-2 text-sm flex items-center justify-between">
                    <div>
                      <div className="text-gray-900">{r.users?.full_name || 'Employee'}</div>
                      <div className="text-gray-500">{r.users?.email}</div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.status === 'approved' ? 'bg-green-100 text-green-800' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        {r.status}
                      </div>
                      {r.approved_at && (
                        <div className="text-xs text-gray-500 mt-1">By {r.approver?.full_name || '—'} at {new Date(r.approved_at).toLocaleTimeString()}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              {/* Card View */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {team.map((member) => (
                    <div key={member.id} className="bg-white rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="p-6">
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              checked={selectedUsers.includes(member.id)}
                              onChange={() => handleSelectUser(member.id)}
                            />
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            member.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {member.role}
                          </span>
                        </div>

                        {/* Avatar and Name */}
                        <div className="flex flex-col items-center text-center mb-4">
                          <img
                            className="h-16 w-16 rounded-full object-cover border-4 border-white shadow-lg"
                            src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.full_name}&size=64&background=6366f1&color=ffffff`}
                            alt={member.full_name}
                          />
                          <h3 className="mt-3 text-lg font-semibold text-gray-900">{member.full_name}</h3>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>

                        {/* Skills */}
                        {member.skills && member.skills.length > 0 && (
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-1">
                              {member.skills.slice(0, 3).map((skill, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {skill}
                                </span>
                              ))}
                              {member.skills.length > 3 && (
                                <span className="text-xs text-gray-500">+{member.skills.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Join Date */}
                        <div className="flex items-center text-sm text-gray-500 mb-4">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          Joined {new Date(member.created_at).toLocaleDateString()}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleMessageClick(member)}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                          >
                            <ChatIcon className="h-4 w-4 mr-1" />
                            Message
                          </button>
                          <button
                            onClick={() => handleEditEmployee(member)}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />
                            Edit
                          </button>
                          <button
                            onClick={() => sendPin(member.id)}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-green-300 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                          >
                            Send PIN
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Table View */}
              {viewMode === 'table' && (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="relative w-12 px-6 sm:w-16 sm:px-8">
                          <input
                            type="checkbox"
                            className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6"
                            checked={selectedUsers.length === team.length}
                            onChange={handleSelectAll}
                            aria-label="Select all team members"
                          />
                        </th>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                          Name
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Email
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Role
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Skills
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Joined
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {team.map((member) => (
                        <tr key={member.id}>
                          <td className="relative w-12 px-6 sm:w-16 sm:px-8">
                            <input
                              type="checkbox"
                              className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6"
                              checked={selectedUsers.includes(member.id)}
                              onChange={() => handleSelectUser(member.id)}
                              aria-label={`Select ${member.full_name}`}
                            />
                          </td>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0">
                                <img
                                  className="h-10 w-10 rounded-full"
                                  src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.full_name}`}
                                  alt=""
                                />
                              </div>
                              <div className="ml-4">
                                <div className="font-medium text-gray-900">{member.full_name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{member.email}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">{member.role}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {member.skills?.map((skill, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {new Date(member.created_at).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleMessageClick(member)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                <ChatIcon className="h-4 w-4 mr-1" />
                                Message
                              </button>
                              <button
                                onClick={() => handleEditEmployee(member)}
                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                <PencilIcon className="h-4 w-4 mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => sendPin(member.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-green-300 text-xs font-medium rounded-full shadow-sm text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                Send PIN
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {/* Bulk Selection Header */}
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedUsers.length === team.length}
                      onChange={handleSelectAll}
                      aria-label="Select all team members"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      Select All ({team.length})
                    </span>
                  </div>
                  {selectedUsers.length > 0 && (
                    <span className="text-sm text-indigo-600 font-medium">
                      {selectedUsers.length} selected
                    </span>
                  )}
                </div>

                {/* Employee Cards */}
                {team.map((member) => (
                  <div key={member.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-1"
                          checked={selectedUsers.includes(member.id)}
                          onChange={() => handleSelectUser(member.id)}
                          aria-label={`Select ${member.full_name}`}
                        />
                        <div className="h-12 w-12 flex-shrink-0">
                          <img
                            className="h-12 w-12 rounded-full"
                            src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.full_name}`}
                            alt=""
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-medium text-gray-900 truncate">{member.full_name}</h3>
                          <p className="text-sm text-gray-500 truncate">{member.email}</p>
                          <div className="mt-1 flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              member.role === 'admin' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {member.role}
                            </span>
                            <span className="text-xs text-gray-400">
                              Joined {new Date(member.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Skills Section */}
                    {member.skills && member.skills.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-1">
                          {member.skills.map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => handleMessageClick(member)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <ChatIcon className="h-4 w-4 mr-2" />
                        Message
                      </button>
                      <button
                        onClick={() => handleEditEmployee(member)}
                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {/* Direct Message Modal */}
      <DirectMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => {
          setIsMessageModalOpen(false);
          setSelectedUser(null);
        }}
        recipient={selectedUser}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Permanently Delete Team Members
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to permanently delete {selectedUsers.length} selected team member{selectedUsers.length === 1 ? '' : 's'}? This action cannot be undone.
                    </p>
                    <div className="mt-4">
                      <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                        Deletion Reason
                      </label>
                      <textarea
                        id="reason"
                        name="reason"
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        placeholder="Please provide a reason for deletion"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDeleteSelected}
                >
                  Delete Permanently
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeletionReason('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deleted Users Modal */}
      <DeletedUsersModal
        isOpen={isDeletedUsersModalOpen}
        onClose={() => setIsDeletedUsersModalOpen(false)}
      />

      {/* Employee Form Modal */}
      <EmployeeForm
        isOpen={isEmployeeFormOpen}
        onClose={() => {
          setIsEmployeeFormOpen(false);
          setEditingEmployee(null);
        }}
        onSubmit={handleEmployeeSubmit}
        employee={editingEmployee}
        mode={formMode}
      />
    </Layout>
  );
} 

export default withPermission(Team, {
  pageName: 'employee_management',
  requiredPermission: 'view',
  showPermissionIndicator: true
}); 