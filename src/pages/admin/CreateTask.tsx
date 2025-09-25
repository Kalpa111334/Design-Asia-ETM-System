import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import EnhancedTaskForm from '../../components/admin/EnhancedTaskForm';
import { supabase } from '../../lib/supabase';
import { GeofencingService } from '../../services/GeofencingService';
import { AttachmentService } from '../../services/AttachmentService';
import toast from 'react-hot-toast';

export default function CreateTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: any) {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([
          {
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            // keep single assignee for backward compatibility (first selected)
            assigned_to: (formData.assigned_to_ids && formData.assigned_to_ids[0]) || formData.assigned_to || null,
            due_date: formData.due_date,
            start_date: formData.start_date,
            end_date: formData.end_date,
            time_assigning: formData.time_assigning,
            estimated_time: formData.estimated_time || formData.time_assigning, // Use estimated_time or fallback to time_assigning
            price: formData.price,
            progress_percentage: formData.status === 'In Progress' ? (formData.progress_percentage ?? null) : null,
            location_required: formData.location_required,
            location_latitude: formData.location_latitude,
            location_longitude: formData.location_longitude,
            location_radius_meters: formData.location_radius_meters,
            auto_check_in: formData.auto_check_in,
            auto_check_out: formData.auto_check_out,
            job_id: formData.job_id || null,
            status: formData.status || 'Not Started',
            started_at: formData.status === 'In Progress' ? new Date().toISOString() : null,
            completed_at: formData.status === 'Completed' ? new Date().toISOString() : null,
            created_by: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Create multi-assignee links if provided
      if (task && Array.isArray(formData.assigned_to_ids) && formData.assigned_to_ids.length > 0) {
        const assigneesPayload = formData.assigned_to_ids
          .filter((uid: string) => !!uid)
          .map((uid: string) => ({ task_id: task.id, user_id: uid }));

        if (assigneesPayload.length > 0) {
          const { error: assigneesError } = await supabase
            .from('task_assignees')
            .insert(assigneesPayload);

          if (assigneesError) {
            console.error('Error inserting task assignees:', assigneesError);
            // Non-fatal; continue
          }
        }
      }

      // Create task locations if provided
      if (formData.locations && formData.locations.length > 0 && task) {
        const locationData = formData.locations.map((location: any) => ({
          task_id: task.id,
          geofence_id: location.geofence_id,
          required_latitude: location.latitude,
          required_longitude: location.longitude,
          required_radius_meters: location.radius_meters,
          arrival_required: location.arrival_required,
          departure_required: location.departure_required,
        }));

        const { error: locationError } = await supabase
          .from('task_locations')
          .insert(locationData);

        if (locationError) {
          console.error('Error creating task locations:', locationError);
          // Don't fail the entire operation for this
        }
      }

      // Create task attachments if provided
      if (formData.attachments && formData.attachments.length > 0 && task) {
        console.log('Processing attachments for new task:', formData.attachments.length);
        
        // Upload each attachment to the database
        for (const attachment of formData.attachments) {
          try {
            // Skip attachments that are already uploaded (have an ID)
            if (attachment.id) {
              console.log('Attachment already uploaded:', attachment.file_name);
              continue;
            }

            // For local attachments (created during task creation), we need to upload them
            if (attachment.file_url && attachment.file_url.startsWith('blob:')) {
              // This is a local file, we need to convert it to a File object and upload
              console.log('Uploading local attachment:', attachment.file_name);
              
              // Create a File object from the blob URL
              const response = await fetch(attachment.file_url);
              const blob = await response.blob();
              const file = new File([blob], attachment.file_name, { type: attachment.file_type });
              
              // Upload using AttachmentService
              const uploadResult = await AttachmentService.uploadFile(file, task.id);
              
              if (uploadResult.success) {
                console.log('Successfully uploaded attachment:', attachment.file_name);
              } else {
                console.error('Failed to upload attachment:', attachment.file_name, uploadResult.error);
                toast.error(`Failed to upload ${attachment.file_name}: ${uploadResult.error}`);
              }
            } else {
              // This is already a remote URL, create database record directly
              console.log('Creating database record for remote attachment:', attachment.file_name);
              
              const { data: { user } } = await supabase.auth.getUser();
              const attachmentData = {
                task_id: task.id,
                file_name: attachment.file_name,
                file_size: attachment.file_size,
                file_type: attachment.file_type,
                file_url: attachment.file_url,
                uploaded_by: user?.id
              };

              const { error: attachmentError } = await supabase
                .from('task_attachments')
                .insert([attachmentData]);

              if (attachmentError) {
                console.error('Error creating attachment record:', attachmentError);
                toast.error(`Failed to save ${attachment.file_name}: ${attachmentError.message}`);
              } else {
                console.log('Successfully created attachment record:', attachment.file_name);
              }
            }
          } catch (error: any) {
            console.error('Error processing attachment:', attachment.file_name, error);
            toast.error(`Failed to process ${attachment.file_name}: ${error.message}`);
          }
        }
      }

      toast.success('Task created successfully');
      navigate('/admin/tasks');
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Create New Task</h1>
        </div>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="mt-4 sm:mt-6 lg:mt-8">
            <div className="bg-white shadow px-3 sm:px-4 py-4 sm:py-5 sm:rounded-lg sm:p-6">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
                <div className="lg:col-span-1">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">Task Details</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Provide the details for the new task, including location requirements if needed.
                  </p>
                </div>
                <div className="mt-2 lg:mt-0 lg:col-span-2">
                  <EnhancedTaskForm onSubmit={handleSubmit} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}