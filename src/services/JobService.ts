import { supabase } from '../lib/supabase';
import { Job, CreateJobData, UpdateJobData, JobFilters, Material } from '../types/job';
import type { User } from '../types';

export class JobService {
  private static readonly TABLE_NAME = 'jobs';
  private static readonly MATERIALS_TABLE_NAME = 'job_materials';

  /**
   * Generate next job number (JOB-001, JOB-002, etc.)
   */
  private static async generateJobNumber(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('job_number')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        return 'JOB-001';
      }

      const lastJobNumber = data[0].job_number;
      const lastNumber = parseInt(lastJobNumber.split('-')[1]);
      const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
      
      return `JOB-${nextNumber}`;
    } catch (error) {
      console.error('Error generating job number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-6);
      return `JOB-${timestamp}`;
    }
  }

  /**
   * Create a new job
   */
  static async createJob(data: CreateJobData, createdBy: string): Promise<Job> {
    try {
      // If a job_number was provided (from category + manual id), validate and use it.
      // Otherwise fallback to system-generated number
      let jobNumber = data.job_number?.trim();

      if (jobNumber) {
        // Accept formats like DA-123, AL-001, TB-42
        const validPrefixes = ['DA', 'AL', 'TB'];
        const [prefix, rest] = jobNumber.split('-');
        if (!prefix || !rest || !validPrefixes.includes(prefix)) {
          throw new Error('Invalid job number format. Expected DA-XXX, AL-XXX, or TB-XXX');
        }
        if (!/^\d+$/.test(rest)) {
          throw new Error('Invalid job number. Numeric part required after prefix');
        }
        // Normalize numeric part to at least 3 digits
        jobNumber = `${prefix}-${parseInt(rest, 10).toString().padStart(3, '0')}`;
      } else {
        jobNumber = await this.generateJobNumber();
      }
      
      const jobData = {
        job_number: jobNumber,
        category: (data.job_category || (jobNumber?.split('-')[0] as any)) as 'DA' | 'AL' | 'TB',
        customer_name: data.customer_name,
        contact_number: data.contact_number,
        sales_person: data.sales_person,
        start_date: data.start_date,
        completion_date: data.completion_date,
        contractor_name: data.contractor_name,
        description: data.description,
        created_by: createdBy,
        status: 'active' as const
      };

      const { data: newJob, error } = await supabase
        .from(this.TABLE_NAME)
        .insert(jobData)
        .select()
        .single();

      if (error) throw error;

      // Insert materials if provided
      if (data.materials_issued && data.materials_issued.length > 0) {
        const materialsData = data.materials_issued.map(material => ({
          job_id: newJob.id,
          name: material.name,
          date: material.date,
          description: material.description,
          quantity: material.quantity,
          rate: material.rate,
          amount: material.amount
        }));

        const { error: materialsError } = await supabase
          .from(this.MATERIALS_TABLE_NAME)
          .insert(materialsData);

        if (materialsError) throw materialsError;
      }

      // Fetch the complete job with materials
      const completeJob = await this.getJobById(newJob.id);
      return completeJob;
    } catch (error) {
      console.error('Error creating job:', error);
      throw error;
    }
  }

  /**
   * Get all jobs with optional filtering
   */
  static async getJobs(filters?: JobFilters): Promise<Job[]> {
    try {
      let query = supabase
        .from(this.TABLE_NAME)
        .select(`
          *,
          job_materials (*)
        `)
        .order('created_at', { ascending: false });

      if (filters) {
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.customer_name) {
          query = query.ilike('customer_name', `%${filters.customer_name}%`);
        }
        if (filters.sales_person) {
          query = query.ilike('sales_person', `%${filters.sales_person}%`);
        }
        if (filters.date_from) {
          query = query.gte('start_date', filters.date_from);
        }
        if (filters.date_to) {
          query = query.lte('start_date', filters.date_to);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(job => ({
        ...job,
        materials_issued: job.job_materials || []
      }));
    } catch (error) {
      console.error('Error fetching jobs:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  static async getJobById(id: string): Promise<Job> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select(`
          *,
          job_materials (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        materials_issued: data.job_materials || []
      };
    } catch (error) {
      console.error('Error fetching job by ID:', error);
      throw error;
    }
  }

  /**
   * Update a job
   */
  static async updateJob(id: string, data: UpdateJobData): Promise<Job> {
    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update materials if provided
      if (data.materials_issued) {
        // Delete existing materials
        await supabase
          .from(this.MATERIALS_TABLE_NAME)
          .delete()
          .eq('job_id', id);

        // Insert new materials
        if (data.materials_issued.length > 0) {
          const materialsData = data.materials_issued.map(material => ({
            job_id: id,
            name: material.name,
            date: material.date,
            description: material.description,
            quantity: material.quantity,
            rate: material.rate,
            amount: material.amount
          }));

          const { error: materialsError } = await supabase
            .from(this.MATERIALS_TABLE_NAME)
            .insert(materialsData);

          if (materialsError) throw materialsError;
        }
      }

      // Fetch updated job
      const updatedJob = await this.getJobById(id);
      return updatedJob;
    } catch (error) {
      console.error('Error updating job:', error);
      throw error;
    }
  }

  /**
   * Delete a job
   */
  static async deleteJob(id: string): Promise<void> {
    try {
      // Delete materials first
      await supabase
        .from(this.MATERIALS_TABLE_NAME)
        .delete()
        .eq('job_id', id);

      // Delete job
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting job:', error);
      throw error;
    }
  }

  /**
   * Get jobs for dropdown/selection
   */
  static async getJobsForDropdown(): Promise<Array<{ id: string; job_number: string; customer_name: string; status: string }>> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('id, job_number, customer_name, status')
        .eq('status', 'active')
        .order('job_number', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching jobs for dropdown:', error);
      throw error;
    }
  }

  /**
   * Calculate total material cost for a job
   */
  static calculateTotalMaterialCost(materials: Material[]): number {
    return materials.reduce((total, material) => total + material.amount, 0);
  }

  /**
   * Get job statistics
   */
  static async getJobStatistics(): Promise<{
    total: number;
    active: number;
    completed: number;
    on_hold: number;
    cancelled: number;
  }> {
    try {
      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('status');

      if (error) throw error;

      const stats = {
        total: data.length,
        active: 0,
        completed: 0,
        on_hold: 0,
        cancelled: 0
      };

      data.forEach(job => {
        stats[job.status as keyof typeof stats]++;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching job statistics:', error);
      throw error;
    }
  }
}
