import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { FormStructure } from '../types';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Edit3, BarChart2, ExternalLink, Copy, Check, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Logo from '../components/Logo';

export default function AdminDashboard() {
  const [forms, setForms] = useState<FormStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'forms'),
      where('createdBy', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const formsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FormStructure[];
      setForms(formsData.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const copyToClipboard = (slug: string, id: string) => {
    const url = `${window.location.origin}/forms/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteClick = (formId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormToDelete(formId);
  };

  const confirmDelete = async () => {
    if (!formToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log("Starting deletion for form:", formToDelete);
      
      // 1. Get all responses for this form
      const responsesQuery = query(collection(db, 'responses'), where('formId', '==', formToDelete));
      const responsesSnapshot = await getDocs(responsesQuery);
      console.log("Found responses to delete:", responsesSnapshot.size);

      // 2. Delete responses in batches of 500 (Firestore limit)
      const batchSize = 500;
      const chunks = [];
      
      for (let i = 0; i < responsesSnapshot.docs.length; i += batchSize) {
        chunks.push(responsesSnapshot.docs.slice(i, i + batchSize));
      }

      // Process response batches
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log("Deleted batch of responses");
      }

      // 3. Delete the form itself
      await deleteDoc(doc(db, 'forms', formToDelete));
      console.log("Form deleted successfully");
      setFormToDelete(null);

    } catch (error: any) {
      console.error("Error deleting form:", error);
      alert(`Failed to delete form: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredForms = forms.filter(form => 
    form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-brand-accent font-bold text-xs uppercase tracking-widest">
              <div className="w-2 h-2 bg-brand-accent animate-pulse rounded-full" />
              System Online
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold tracking-tight">
              Work<span className="text-brand-accent">space</span>
            </h1>
            <p className="text-white/40 max-w-xl text-sm sm:text-base">Manage your neural data structures, event streams, and member engagement pipelines.</p>
          </div>
          <Link
            to="/admin/create"
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-brand-accent text-brand-bg font-bold rounded-2xl hover:bg-white transition-all accent-glow w-full sm:w-auto"
          >
            <Plus size={24} />
            <span>Create New Form</span>
          </Link>
        </div>

        <div className="relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-brand-accent transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search forms by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/[0.02] border border-white/5 rounded-3xl py-6 pl-16 pr-8 focus:outline-none focus:border-brand-accent/50 transition-all text-lg placeholder:text-white/10"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 glass rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredForms.map((form) => (
                <motion.div
                  key={form.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass p-8 rounded-[2.5rem] flex flex-col justify-between min-h-[340px] group hover:bg-white/[0.05] transition-all duration-500"
                >
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center">
                          <Logo className="w-8 h-8" />
                        </div>
                        <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${form.isOpen !== false ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                          {form.isOpen !== false ? 'Active' : 'Closed'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(form.slug, form.id)}
                          className="p-3 text-white/20 hover:text-brand-accent transition-all"
                          title="Copy share link"
                        >
                          {copiedId === form.id ? <Check size={20} /> : <Copy size={20} />}
                        </button>
                        <Link
                          to={`/forms/${form.slug}`}
                          target="_blank"
                          className="p-3 text-white/20 hover:text-brand-accent transition-all"
                          title="View public form"
                        >
                          <ExternalLink size={20} />
                        </Link>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight line-clamp-1">{form.title}</h3>
                      <div 
                        className="text-white/40 text-sm line-clamp-2 mt-2 leading-relaxed prose prose-invert prose-p:text-white/40 prose-headings:text-white/80 prose-strong:text-white/80 prose-a:text-brand-accent"
                        dangerouslySetInnerHTML={{ __html: form.description }}
                      />
                    </div>
                  </div>

                  <div className="space-y-6 pt-8">
                    <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-white/20 uppercase">
                      <span className="flex items-center gap-2">
                        {form.fields.length} Fields
                      </span>
                      <span>{new Date(form.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <Link
                        to={`/admin/responses/${form.id}`}
                        className="flex flex-col items-center justify-center py-4 glass rounded-2xl hover:bg-brand-accent hover:text-brand-bg transition-all group/btn"
                      >
                        <BarChart2 size={20} className="mb-1" />
                        <span className="text-[9px] uppercase font-bold tracking-widest">Stats</span>
                      </Link>
                      <Link
                        to={`/admin/edit/${form.id}`}
                        className="flex flex-col items-center justify-center py-4 glass rounded-2xl hover:bg-brand-accent hover:text-brand-bg transition-all group/btn"
                      >
                        <Edit3 size={20} className="mb-1" />
                        <span className="text-[9px] uppercase font-bold tracking-widest">Edit</span>
                      </Link>
                      <button
                        onClick={(e) => handleDeleteClick(form.id, e)}
                        className="flex flex-col items-center justify-center py-4 glass rounded-2xl hover:bg-red-500/20 hover:text-red-500 transition-all group/btn"
                      >
                        <Trash2 size={20} className="mb-1" />
                        <span className="text-[9px] uppercase font-bold tracking-widest">Delete</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredForms.length === 0 && (
              <div className="col-span-full py-32 text-center glass rounded-[3rem]">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="text-white/10" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white/40 tracking-tight">No forms found</h3>
                <p className="text-white/20 text-sm mt-2">Try adjusting your search or create a new form.</p>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {formToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="text-red-500" size={24} />
              </div>
              
              <h3 className="text-2xl font-bold text-center mb-2">Delete Form?</h3>
              <p className="text-white/40 text-center mb-8">
                This will permanently delete the form and <strong>all collected responses</strong>. This action cannot be undone.
              </p>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setFormToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Form'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
