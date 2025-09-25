export interface TimeInput {
  hours: number;
  minutes: number;
  totalMinutes: number;
}

export class TimeAssigningUtils {
  /**
   * Convert hours and minutes to total minutes
   */
  static toTotalMinutes(hours: number, minutes: number): number {
    return (hours * 60) + minutes;
  }

  /**
   * Convert total minutes to hours and minutes
   */
  static fromTotalMinutes(totalMinutes: number): TimeInput {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      hours,
      minutes,
      totalMinutes
    };
  }

  /**
   * Format time input for display
   */
  static formatTimeInput(hours: number, minutes: number): string {
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Format time input for display (from total minutes)
   */
  static formatTimeFromMinutes(totalMinutes: number): string {
    const { hours, minutes } = this.fromTotalMinutes(totalMinutes);
    return this.formatTimeInput(hours, minutes);
  }

  /**
   * Parse time string input (e.g., "2h 30m", "90m", "1.5h")
   */
  static parseTimeString(timeString: string): TimeInput {
    const cleanString = timeString.trim().toLowerCase();
    
    // Handle "Xh Ym" format
    const hourMinuteMatch = cleanString.match(/(\d+)h\s*(\d+)m?/);
    if (hourMinuteMatch) {
      const hours = parseInt(hourMinuteMatch[1]);
      const minutes = parseInt(hourMinuteMatch[2] || '0');
      return {
        hours,
        minutes,
        totalMinutes: this.toTotalMinutes(hours, minutes)
      };
    }

    // Handle "Xh" format
    const hourMatch = cleanString.match(/(\d+(?:\.\d+)?)h/);
    if (hourMatch) {
      const hours = parseFloat(hourMatch[1]);
      const totalMinutes = Math.round(hours * 60);
      return this.fromTotalMinutes(totalMinutes);
    }

    // Handle "Xm" format
    const minuteMatch = cleanString.match(/(\d+)m/);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1]);
      return this.fromTotalMinutes(minutes);
    }

    // Handle plain number (assume minutes)
    const numberMatch = cleanString.match(/^\d+$/);
    if (numberMatch) {
      const minutes = parseInt(numberMatch[1]);
      return this.fromTotalMinutes(minutes);
    }

    // Default to 0
    return { hours: 0, minutes: 0, totalMinutes: 0 };
  }

  /**
   * Validate time input
   */
  static validateTimeInput(hours: number, minutes: number): { isValid: boolean; error?: string } {
    if (hours < 0 || minutes < 0) {
      return { isValid: false, error: 'Time values cannot be negative' };
    }
    
    if (minutes >= 60) {
      return { isValid: false, error: 'Minutes must be less than 60' };
    }
    
    const totalMinutes = this.toTotalMinutes(hours, minutes);
    if (totalMinutes === 0) {
      return { isValid: false, error: 'Time must be greater than 0' };
    }
    
    if (totalMinutes > 1440) { // 24 hours
      return { isValid: false, error: 'Time cannot exceed 24 hours' };
    }
    
    return { isValid: true };
  }

  /**
   * Get time input suggestions
   */
  static getTimeSuggestions(): Array<{ label: string; hours: number; minutes: number; totalMinutes: number }> {
    return [
      { label: '15 minutes', hours: 0, minutes: 15, totalMinutes: 15 },
      { label: '30 minutes', hours: 0, minutes: 30, totalMinutes: 30 },
      { label: '1 hour', hours: 1, minutes: 0, totalMinutes: 60 },
      { label: '1.5 hours', hours: 1, minutes: 30, totalMinutes: 90 },
      { label: '2 hours', hours: 2, minutes: 0, totalMinutes: 120 },
      { label: '3 hours', hours: 3, minutes: 0, totalMinutes: 180 },
      { label: '4 hours', hours: 4, minutes: 0, totalMinutes: 240 },
      { label: '6 hours', hours: 6, minutes: 0, totalMinutes: 360 },
      { label: '8 hours', hours: 8, minutes: 0, totalMinutes: 480 },
    ];
  }
}


























