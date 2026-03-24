import { Link, useNavigate } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogOut, LayoutDashboard, PlusCircle, Home } from 'lucide-react';
import Logo from './Logo';

interface NavbarProps {
  user: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav className="sticky top-4 z-50 px-2 sm:px-4">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 h-14 flex items-center justify-between rounded-full border border-white/10 bg-brand-bg/60 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <Link to="/" className="flex items-center gap-4 group shrink-0">
          <Logo className="w-8 h-8 sm:w-10 sm:h-10" />
          <span className="text-sm sm:text-base font-bold tracking-[0.2em] text-white hidden sm:block">
            NEURONYX
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-6">
          {user && (
            <Link 
              to="/" 
              className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-brand-accent transition-colors flex items-center gap-1.5"
            >
              <Home size={14} />
              <span className="hidden sm:inline">Portal</span>
            </Link>
          )}
          
          {user ? (
            <>
              <button 
                onClick={handleLogout}
                className="text-[10px] font-bold uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1.5"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </>
          ) : (
            <Link 
              to="/login" 
              className="px-3 sm:px-4 py-1.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-brand-accent hover:text-brand-bg transition-all"
            >
              Auth
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
