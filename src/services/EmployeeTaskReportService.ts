import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { Task } from '../types/index';

interface EmployeeTaskReportData {
  taskName: string;
  dueDate: string;
  priority: string;
  status: string;
  completionDate: string;
  notes: string;
  percentage: number;
  overdue: string;
  assignedDate: string;
  timeAssigned: string;
}

export class EmployeeTaskReportService {
  /**
   * Generate employee-specific task report PDF
   */
  static async generateEmployeeReport(
    employeeId: string, 
    employeeName: string, 
    date: Date = new Date()
  ): Promise<{ success: boolean; error?: string; blob?: Blob }> {
    try {
      // Get start and end of the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch tasks assigned to specific employee for the day
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          users!tasks_assigned_to_fkey(full_name)
        `)
        .eq('assigned_to', employeeId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Transform data for report
      const reportData: EmployeeTaskReportData[] = tasks.map(task => {
        const dueDate = new Date(task.due_date);
        const completionDate = task.completed_at ? new Date(task.completed_at) : null;
        const assignedDate = new Date(task.created_at);
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

        // Format time assigned
        const timeAssigned = task.time_assigning 
          ? `${Math.floor(task.time_assigning / 60)}h ${task.time_assigning % 60}m`
          : 'Not set';

        return {
          taskName: task.title,
          dueDate: dueDate.toLocaleDateString(),
          priority: task.priority,
          status: task.status,
          completionDate: completionDate ? completionDate.toLocaleDateString() : '-',
          notes: task.completion_notes || '-',
          percentage: Math.round(percentage),
          overdue: isOverdue ? 'Yes' : 'No',
          assignedDate: assignedDate.toLocaleDateString(),
          timeAssigned: timeAssigned
        };
      });

      // Generate PDF
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      
      // Add title
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Employee Task Report', 14, 20);
      
      // Add employee name and date
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Employee: ${employeeName}`, 14, 30);
      pdf.text(`Report Date: ${date.toLocaleDateString()}`, 14, 36);
      
      // Add summary statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'Completed').length;
      const overdueTasks = tasks.filter(t => {
        const dueDate = new Date(t.due_date);
        return dueDate < new Date() && t.status !== 'Completed';
      }).length;
      const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
      
      pdf.text(`Total Tasks: ${totalTasks} | Completed: ${completedTasks} | In Progress: ${inProgressTasks} | Overdue: ${overdueTasks}`, 14, 46);

      // Generate table
      autoTable(pdf, {
        startY: 56,
        head: [['Task Name', 'Due Date', 'Priority', 'Status', 'Completion Date', 'Notes', 'Progress %', 'Overdue', 'Assigned Date', 'Time Assigned']],
        body: reportData.map(task => [
          task.taskName,
          task.dueDate,
          task.priority,
          task.status,
          task.completionDate,
          task.notes,
          `${task.percentage}%`,
          task.overdue,
          task.assignedDate,
          task.timeAssigned
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
          0: { cellWidth: 35 }, // Task Name
          1: { cellWidth: 18 }, // Due Date
          2: { cellWidth: 12 }, // Priority
          3: { cellWidth: 15 }, // Status
          4: { cellWidth: 20 }, // Completion Date
          5: { cellWidth: 25 }, // Notes
          6: { cellWidth: 12 }, // Progress %
          7: { cellWidth: 12 }, // Overdue
          8: { cellWidth: 18 }, // Assigned Date
          9: { cellWidth: 15 }, // Time Assigned
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
      const finalY = (pdf as any).lastAutoTable?.finalY || 56;
      pdf.setFontSize(8);
      pdf.text(`Report generated on: ${new Date().toLocaleString()}`, 14, finalY + 20);

      // Generate blob
      const pdfBlob = pdf.output('blob');
      
      return { success: true, blob: pdfBlob };
    } catch (error: any) {
      console.error('Error generating employee report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Download the PDF report
   */
  static downloadReport(blob: Blob, employeeName: string, date?: Date) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const filename = `employee-task-report-${employeeName.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.pdf`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate and download employee report
   */
  static async generateAndDownloadReport(employeeId: string, employeeName: string, date?: Date) {
    const result = await this.generateEmployeeReport(employeeId, employeeName, date);
    if (result.success && result.blob) {
      this.downloadReport(result.blob, employeeName, date);
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  }
}
