import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { EmailService } from '../services/EmailService';
import { supabase } from '../lib/supabase';
import { LoginPinService } from '../services/LoginPinService';
import toast from 'react-hot-toast';

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'employee' as 'admin' | 'employee',
  });
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signUp(formData.email, formData.password, formData.fullName, formData.role);
      // Best-effort welcome email with login link
      EmailService.sendWelcomeEmail(formData.email, formData.fullName).catch(() => {});

      // Attempt immediate sign-in for auto-redirect + PIN flow (if email confirmation not required)
      try {
        await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        const { data: { user } } = await supabase.auth.getUser();
        if (user && (user.user_metadata?.role || formData.role) !== 'admin') {
          const created = await LoginPinService.createPin(user.id, 30);
          if (created.success && created.pin) {
            toast.loading('Waiting for admin approval (30s)...', { id: 'pin-wait' });
            setCountdown(30);
            const pinId = created.pin.id;
            let timeoutId: number | undefined;
            let countdownId: number | undefined;
            const channel = supabase
              .channel(`register-pin-${pinId}`)
              .on('postgres_changes', { event: '*', schema: 'public', table: 'login_pins', filter: `id=eq.${pinId}` }, (payload: any) => {
                const status = (payload.new || {}).status;
                if (status === 'approved') {
                  toast.dismiss('pin-wait');
                  toast.success('Login approved');
                  sessionStorage.setItem('justApprovedLogin', '1');
                  try { if (timeoutId) window.clearTimeout(timeoutId); if (countdownId) window.clearInterval(countdownId); } catch {}
                  channel.unsubscribe();
                  setCountdown(null);
                  navigate('/employee', { replace: true });
                } else if (status === 'rejected' || status === 'expired') {
                  toast.dismiss('pin-wait');
                  toast.error('Login not approved');
                  try { if (timeoutId) window.clearTimeout(timeoutId); if (countdownId) window.clearInterval(countdownId); } catch {}
                  channel.unsubscribe();
                  setCountdown(null);
                }
              })
              .subscribe();
            timeoutId = window.setTimeout(() => {
              try { supabase.removeChannel(channel); } catch {}
              toast.dismiss('pin-wait');
              toast.error('Approval timed out');
              setCountdown(null);
            }, 30000);

            // Countdown timer
            countdownId = window.setInterval(() => {
              setCountdown(prev => {
                if (prev == null || prev <= 1) {
                  try { window.clearInterval(countdownId); } catch {}
                  return null;
                }
                toast.loading(`Waiting for admin approval (${prev - 1}s)...`, { id: 'pin-wait' });
                return prev - 1;
              });
            }, 1000);
            return; // wait for approval and redirect to employee dashboard
          }
        }
      } catch {
        // Silent: fallback to normal flow below
      }

      toast.success('Registration successful! Please login to continue.');
      navigate('/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
      <div className="max-w-md w-full space-y-8 p-8 bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl">
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">
            Create Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join us to start managing tasks efficiently
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-pink-200 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-150 ease-in-out"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-pink-200 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-150 ease-in-out"
                placeholder="Choose a strong password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
              />
            </div>
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-pink-200 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-150 ease-in-out"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
              />
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                id="role"
                name="role"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-pink-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-150 ease-in-out"
                value={formData.role}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    role: e.target.value as 'admin' | 'employee',
                  }))
                }
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 transition-all duration-150 ease-in-out transform hover:scale-[1.02]"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Sign up'
              )}
            </button>
          </div>
        </form>

        <div className="text-sm text-center">
          <Link
            to="/login"
            className="font-medium text-pink-600 hover:text-rose-500 transition-colors duration-150"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
} 