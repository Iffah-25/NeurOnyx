import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './lib/firebase';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FormBuilder from './pages/FormBuilder';
import FormView from './pages/FormView';
import Responses from './pages/Responses';
import Navbar from './components/Navbar';
import { AlertCircle, ExternalLink, ShieldAlert } from 'lucide-react';

function AppContent({ user }: { user: User | null }) {
  const location = useLocation();
  const isFormView = location.pathname.startsWith('/forms/');

  return (
    <div className="min-h-screen bg-brand-bg text-white selection:bg-brand-accent/30">
      {!isFormView && <Navbar user={user} />}
      <main className={`container mx-auto px-4 ${isFormView ? 'py-0' : 'py-8'}`}>
        <Routes>
          <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
          <Route path="/login" element={user ? <Navigate to="/admin" /> : <Login />} />
          <Route 
            path="/admin" 
            element={user ? <AdminDashboard /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin/create" 
            element={user ? <FormBuilder /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin/edit/:id" 
            element={user ? <FormBuilder /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin/responses/:id" 
            element={user ? <Responses /> : <Navigate to="/login" />} 
          />
          <Route path="/forms/:slug" element={<FormView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-brand-bg text-white flex items-center justify-center p-4">
        <div className="max-w-xl w-full p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-brand-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="text-brand-accent" size={40} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Configuration Required</h1>
            <p className="text-white/40 text-lg">To start using NeurOnyx Forms, you need to connect your Firebase project.</p>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-accent text-brand-bg text-xs flex items-center justify-center">1</span>
                Get your Firebase Config
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink size={12} /></a>, create a project, and add a Web App to get your configuration keys.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-accent text-brand-bg text-xs flex items-center justify-center">2</span>
                Set Environment Variables
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Add the following keys to your environment or <code>.env</code> file:
              </p>
              <div className="bg-brand-bg/40 p-4 rounded-xl font-mono text-[10px] text-brand-accent/80 space-y-1 overflow-x-auto">
                <div>VITE_FIREBASE_API_KEY="..."</div>
                <div>VITE_FIREBASE_AUTH_DOMAIN="..."</div>
                <div>VITE_FIREBASE_PROJECT_ID="..."</div>
                <div>VITE_FIREBASE_STORAGE_BUCKET="..."</div>
                <div>VITE_FIREBASE_MESSAGING_SENDER_ID="..."</div>
                <div>VITE_FIREBASE_APP_ID="..."</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-accent/5 border border-brand-accent/10 text-brand-accent/60 text-xs">
            <AlertCircle size={16} />
            Once configured, the application will automatically unlock.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <AppContent user={user} />
    </Router>
  );
}
