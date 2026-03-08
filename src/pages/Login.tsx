import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('The email or password you entered is incorrect.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid login credentials.');
      } else {
        setError('An error occurred during login. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-pattern flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass p-6 sm:p-8 md:p-12 relative overflow-hidden rounded-2xl sm:rounded-none"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent/20" />
        
        <div className="text-center mb-8 md:mb-12">
          <Logo className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6" showText={true} />
          <div className="flex items-center justify-center gap-3 text-brand-accent font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em] mb-2">
            <div className="w-4 h-px bg-brand-accent" />
            Security_Protocol_Active
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-display uppercase tracking-tight text-white">Admin_Access</h2>
          <p className="text-white/20 font-serif italic text-xs md:text-sm mt-2">Enter credentials for neural uplink</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 md:space-y-8">
          <div className="space-y-3">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-white/20 ml-1">Identity_Token</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/10 rounded-none py-4 pl-12 pr-4 focus:outline-none focus:border-brand-accent/50 transition-all font-mono text-sm placeholder:text-white/5"
                placeholder="ADMIN_ID@NEURONYX.CORE"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-white/20 ml-1">Access_Key</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/10 rounded-none py-4 pl-12 pr-4 focus:outline-none focus:border-brand-accent/50 transition-all font-mono text-sm placeholder:text-white/5"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 border border-red-500/20 bg-red-500/5 text-red-400 font-mono text-[10px] uppercase tracking-widest flex items-center gap-3">
              <AlertCircle size={14} />
              Auth_Error: {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full py-5 bg-brand-accent text-brand-bg font-black uppercase tracking-[0.3em] text-xs overflow-hidden transition-all hover:bg-white disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10">
              {loading ? 'Authenticating...' : 'Establish_Uplink'}
            </span>
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center">
          <div className="font-mono text-[8px] text-white/10 uppercase tracking-widest">
            Node_ID: {Math.random().toString(36).substring(7).toUpperCase()}
          </div>
          <div className="font-mono text-[8px] text-white/10 uppercase tracking-widest">
            Status: Encrypted
          </div>
        </div>
      </motion.div>
    </div>
  );
}
