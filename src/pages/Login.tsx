import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginPinService } from '../services/LoginPinService';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
      
      // Get user role from the database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // If employee role, enforce PIN approval ONLY if not yet verified
      const { data: roleRow } = await supabase.from('users').select('role, is_login_verified').eq('id', user.id).single();
      const role = roleRow?.role || user.user_metadata?.role || 'employee';
      const verified = !!roleRow?.is_login_verified;
      if (role !== 'admin' && !verified) {
        // Create a short-lived PIN request and wait for approval via realtime for up to 30s
        const created = await LoginPinService.createPin(user.id, 30);
        if (!created.success || !created.pin) throw new Error(created.error || 'Failed to create login PIN');

        toast.loading('Waiting for admin approval (30s)...', { id: 'pin-wait' });
        setCountdown(30);

        // Subscribe to this pin status
        const pinId = created.pin.id;
        let timeoutId: number | undefined;
        let countdownId: number | undefined;
        const channel = supabase
          .channel(`login-pin-${pinId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'login_pins', filter: `id=eq.${pinId}` }, (payload: any) => {
            const status = (payload.new || {}).status;
            if (status === 'approved') {
              toast.dismiss('pin-wait');
              toast.success('Login approved');
              sessionStorage.setItem('justApprovedLogin', '1');
              try { if (timeoutId) window.clearTimeout(timeoutId); if (countdownId) window.clearInterval(countdownId); } catch {}
              channel.unsubscribe();
              setCountdown(null);
              // Redirect immediately without extra steps
              if (role === 'admin') {
                navigate('/admin', { replace: true });
              } else {
                const params = new URLSearchParams(location.search);
                const mid = params.get('meetingId');
                const type = params.get('type');
                if (mid && type) {
                  navigate(`/employee?meetingId=${encodeURIComponent(mid)}&type=${encodeURIComponent(type)}`, { replace: true });
                } else {
                  navigate('/employee', { replace: true });
                }
              }
              toast.success('Successfully logged in!');
              // Mark user verified after first approval (fire-and-forget)
              supabase
                .from('users')
                .update({ is_login_verified: true })
                .eq('id', user.id)
                .then(() => {})
                .catch(() => {});
            } else if (status === 'rejected' || status === 'expired') {
              toast.dismiss('pin-wait');
              toast.error('Login not approved');
              try { if (timeoutId) window.clearTimeout(timeoutId); if (countdownId) window.clearInterval(countdownId); } catch {}
              channel.unsubscribe();
              setCountdown(null);
              setLoading(false);
            }
          })
          .subscribe();

        // Timeout after 30s
        timeoutId = window.setTimeout(() => {
          try { supabase.removeChannel(channel); } catch {}
          toast.dismiss('pin-wait');
          toast.error('Approval timed out');
          setCountdown(null);
          setLoading(false);
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
        return; // wait for approval
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) {
        // If user doesn't exist in users table, try to get role from auth metadata
        const role = user.user_metadata?.role || 'employee';
        console.warn('User not found in users table, using auth metadata role:', role);
        
        // Redirect based on role from auth metadata
        if (role === 'admin') {
          navigate('/admin');
        } else {
          const params = new URLSearchParams(location.search);
          const mid = params.get('meetingId');
          const type = params.get('type');
          if (mid && type) {
            navigate(`/employee?meetingId=${encodeURIComponent(mid)}&type=${encodeURIComponent(type)}`);
          } else {
            navigate('/employee');
          }
        }
        toast.success('Successfully logged in!');
        return;
      }

      // Redirect based on role (preserve meeting params if present)
      proceedAfterLogin(userData?.role === 'admin' ? 'admin' : 'employee');
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to login';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and Supabase configuration.';
      } else if (error.message?.includes('Missing Supabase environment variables')) {
        errorMessage = 'Server configuration error. Please contact administrator.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // If a session already exists, redirect immediately to the correct dashboard
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: userRow } = await supabase.from('users').select('role').eq('id', session.user.id).single();
      const role = userRow?.role || session.user.user_metadata?.role || 'employee';
      if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/employee', { replace: true });
      }
    })();
  }, []);

  function proceedAfterLogin(role: 'admin' | 'employee') {
    if (role === 'admin') {
      navigate('/admin');
    } else {
      const params = new URLSearchParams(location.search);
      const mid = params.get('meetingId');
      const type = params.get('type');
      if (mid && type) {
        navigate(`/employee?meetingId=${encodeURIComponent(mid)}&type=${encodeURIComponent(type)}`);
      } else {
        navigate('/employee');
      }
    }
    toast.success('Successfully logged in!');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200">
      <div className="max-w-md w-full space-y-8 p-8 bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl">
        <div>
          <h2 className="mt-2 text-center text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500">
            Welcome Back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account to continue
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
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
              />
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
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>

        <div className="text-sm text-center">
          <Link
            to="/register"
            className="font-medium text-pink-600 hover:text-rose-500 transition-colors duration-150"
          >
            Don't have an account? Sign up
          </Link>
        </div>
      </div>
    </div>
  );
} 