import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Task } from '../types/index';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface TaskReportData {
  taskName: string;
  dueDate: string;
  priority: string;
  completionDate: string;
  notes: string;
  percentage: number;
  overdue: string;
  assignedTo: string;
  status: string;
}

export class DailyTaskReportService {
  /**
   * Generate daily task summary PDF report
   */
  static async generateDailyReport(date: Date = new Date()): Promise<{ success: boolean; error?: string; blob?: Blob }> {
    try {
      // Get start and end of the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch tasks assigned for the day
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          users!tasks_assigned_to_fkey(full_name)
        `)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Transform data for report
      const reportData: TaskReportData[] = tasks.map(task => {
        const dueDate = new Date(task.due_date);
        const completionDate = task.completed_at ? new Date(task.completed_at) : null;
        const isOverdue = dueDate < new Date() && task.status !== 'Completed';
        
        // Calculate completion percentage
        let percentage = 0;
        if (task.status === 'Completed') {
          percentage = 100;
        } else if (task.status === 'In Progress' && task.started_at) {
          const startTime = new Date(task.started_at).getTime();
          const currentTime = new Date().getTime();
          const totalTime = task.time_assigning ? task.time_assigning * 60 * 1000 : 0;
          if (totalTime > 0) {
            percentage = Math.min(100, Math.max(0, ((currentTime - startTime) / totalTime) * 100));
          }
        }

        return {
          taskName: task.title,
          dueDate: dueDate.toLocaleDateString(),
          priority: task.priority,
          completionDate: completionDate ? completionDate.toLocaleDateString() : '-',
          notes: task.completion_notes || '-',
          percentage: Math.round(percentage),
          overdue: isOverdue ? 'Yes' : 'No',
          assignedTo: task.users?.full_name || 'Unassigned',
          status: task.status
        };
      });

      // Generate PDF
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      
      // Add title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Daily Task Summary Report', 14, 20);
      
      // Add date
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Report Date: ${date.toLocaleDateString()}`, 14, 30);
      
      // Add summary statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'Completed').length;
      const overdueTasks = tasks.filter(t => {
        const dueDate = new Date(t.due_date);
        return dueDate < new Date() && t.status !== 'Completed';
      }).length;
      
      pdf.text(`Total Tasks: ${totalTasks} | Completed: ${completedTasks} | Overdue: ${overdueTasks}`, 14, 40);

      // Generate table
      autoTable(pdf, {
        startY: 50,
        head: [['Task Name', 'Assigned To', 'Due Date', 'Priority', 'Status', 'Completion Date', 'Notes', 'Progress %', 'Overdue']],
        body: reportData.map(task => [
          task.taskName,
          task.assignedTo,
          task.dueDate,
          task.priority,
          task.status,
          task.completionDate,
          task.notes,
          `${task.percentage}%`,
          task.overdue
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Task Name
          1: { cellWidth: 25 }, // Assigned To
          2: { cellWidth: 20 }, // Due Date
          3: { cellWidth: 15 }, // Priority
          4: { cellWidth: 20 }, // Status
          5: { cellWidth: 25 }, // Completion Date
          6: { cellWidth: 30 }, // Notes
          7: { cellWidth: 15 }, // Progress %
          8: { cellWidth: 15 }, // Overdue
        },
        didDrawPage: (data) => {
          // Add page numbers
          const pageCount = pdf.getNumberOfPages();
          const currentPage = data.pageNumber;
          pdf.setFontSize(8);
          pdf.text(`Page ${currentPage} of ${pageCount}`, pdf.internal.pageSize.width - 30, pdf.internal.pageSize.height - 10);
        }
      });

      // Add footer with generation time
      const finalY = (pdf as any).lastAutoTable?.finalY || 50;
      pdf.setFontSize(8);
      pdf.text(`Report generated on: ${new Date().toLocaleString()}`, 14, finalY + 20);

      // Generate blob
      const pdfBlob = pdf.output('blob');
      
      return { success: true, blob: pdfBlob };
    } catch (error: any) {
      console.error('Error generating daily report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Download the PDF report
   */
  static downloadReport(blob: Blob, filename?: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `daily-task-report-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate and download daily report
   */
  static async generateAndDownloadReport(date?: Date) {
    const result = await this.generateDailyReport(date);
    if (result.success && result.blob) {
      this.downloadReport(result.blob);
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  }
}
