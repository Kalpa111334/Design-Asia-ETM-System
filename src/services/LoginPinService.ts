import { supabase } from '../lib/supabase';

export interface LoginPinRecord {
  id: string;
  user_id: string;
  code: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
}

export class LoginPinService {
  static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static expiresIn(seconds: number = 30): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  static async createPin(userId: string, ttlSeconds: number = 30): Promise<{ success: boolean; pin?: LoginPinRecord; error?: string }>{
    try {
      // expire any old pending pins for user
      await supabase.rpc('expire_old_login_pins');

      const code = this.generateCode();
      const expires_at = this.expiresIn(ttlSeconds);
      const { data, error } = await supabase
        .from('login_pins')
        .insert([{ user_id: userId, code, expires_at, status: 'pending' }])
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, pin: data as LoginPinRecord };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async approvePin(pinId: string, adminId: string) {
    return supabase
      .from('login_pins')
      .update({ status: 'approved', approved_by: adminId, approved_at: new Date().toISOString() })
      .eq('id', pinId);
  }

  static async rejectPin(pinId: string, adminId: string) {
    return supabase
      .from('login_pins')
      .update({ status: 'rejected', approved_by: adminId, approved_at: new Date().toISOString() })
      .eq('id', pinId);
  }

  static async getLatestForUser(userId: string): Promise<LoginPinRecord | null> {
    const { data, error } = await supabase
      .from('login_pins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return data as LoginPinRecord;
  }
}


