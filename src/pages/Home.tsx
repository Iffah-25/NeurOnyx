import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Zap, Globe, Cpu } from 'lucide-react';
import Logo from '../components/Logo';

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-accent/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/5 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto px-6 pt-24 md:pt-40 pb-32 relative z-10">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-8 md:space-y-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-48 h-48 md:w-64 md:h-64"
          >
            <Logo className="w-full h-full" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8 max-w-5xl"
          >
            <div className="space-y-2 md:space-y-4">
              <h1 className="text-4xl sm:text-6xl md:text-[100px] font-bold tracking-[0.2em] leading-none text-white drop-shadow-[0_0_30px_rgba(0,210,255,0.3)]">
                NEURONYX
              </h1>
              
              <p className="text-xl sm:text-3xl md:text-5xl font-serif italic text-white/90 tracking-tight pt-4">
                From theory to <span className="text-brand-accent">impact</span>
              </p>
            </div>
            
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-center gap-3 md:gap-4">
                <div className="h-px w-12 md:w-24 bg-white/5" />
                <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-brand-accent/30" />
                <div className="h-px w-12 md:w-24 bg-white/5" />
              </div>

              <p className="text-xl sm:text-3xl md:text-5xl font-sans font-light tracking-tighter text-white/70 leading-tight sm:whitespace-nowrap">
                building <span className="font-bold border-b-2 md:border-b-4 border-brand-accent/20 text-white">models</span> that <span className="font-bold text-brand-accent">matter</span>
              </p>
            </div>

            <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed pt-4 font-light">
              Where artificial intelligence meets human creativity. Join our passionate community of 
              students and innovators exploring the frontiers of AI technology.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-4"
          >
            <Link
              to="/login"
              className="w-full sm:w-auto px-10 py-4 bg-brand-accent text-brand-bg font-bold rounded-2xl hover:bg-white transition-all hover:scale-[1.02] active:scale-[0.98] accent-glow text-center text-lg"
            >
              Get Started
            </Link>
            <Link
              to="/admin"
              className="w-full sm:w-auto px-10 py-4 glass glass-hover text-white font-medium rounded-2xl text-center text-lg"
            >
              Admin Console
            </Link>
          </motion.div>
        </div>

        {/* Features */}
        <div className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap size={24} />,
              title: "Real-time Sync",
              description: "Instantaneous data propagation across all nodes with millisecond latency."
            },
            {
              icon: <ShieldCheck size={24} />,
              title: "Secure Core",
              description: "End-to-end encryption and zero-knowledge protocols for all member data."
            },
            {
              icon: <Globe size={24} />,
              title: "Global Edge",
              description: "High-availability distribution network ensuring 99.99% uptime globally."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass p-8 rounded-3xl space-y-4 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center text-brand-accent group-hover:bg-brand-accent group-hover:text-brand-bg transition-all duration-500">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold">{feature.title}</h3>
              <p className="text-white/40 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-40 pt-20 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Active Nodes", value: "50+" },
              { label: "Data Points", value: "2.5M" },
              { label: "Neural Cores", value: "128" },
              { label: "Uptime", value: "99.9%" }
            ].map((stat, i) => (
              <div key={i} className="text-center space-y-1">
                <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/20 uppercase tracking-widest font-bold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
