import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FormStructure, FormResponse } from '../types';
import { motion } from 'motion/react';
import { 
  Download, ChevronLeft, Table as TableIcon, 
  BarChart3, Users, Calendar, ArrowUpRight, Search, Trash2
} from 'lucide-react';

export default function Responses() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormStructure | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [responseToDelete, setResponseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchForm = async () => {
      const docRef = doc(db, 'forms', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setForm({ id: docSnap.id, ...docSnap.data() } as FormStructure);
      }
    };

    const q = query(collection(db, 'responses'), where('formId', '==', id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const responsesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FormResponse[];
      setResponses(responsesData.sort((a, b) => b.submittedAt - a.submittedAt));
      setLoading(false);
    });

    fetchForm();
    return () => unsubscribe();
  }, [id]);

  const handleDeleteClick = (responseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResponseToDelete(responseId);
  };

  const confirmDelete = async () => {
    if (!responseToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log("Deleting response:", responseToDelete);
      await deleteDoc(doc(db, 'responses', responseToDelete));
      console.log("Response deleted successfully");
      setResponseToDelete(null);
    } catch (error: any) {
      console.error("Error deleting response:", error);
      alert(`Failed to delete response: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadCSV = () => {
    if (!form || responses.length === 0) return;

    const exportFields = form.fields.filter(f => f.type !== 'section');
    const headers = ['Submission Date', ...exportFields.map(f => f.label)];
    const rows = responses.map(r => [
      new Date(r.submittedAt).toLocaleString(),
      ...exportFields.map(f => {
        const val = r.data[f.id];
        return Array.isArray(val) ? val.join('; ') : val || '';
      })
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${form.title}_responses.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResponses = responses.filter(r => 
    Object.values(r.data).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" /></div>;

  if (!form) return <div className="text-center py-20">Form not found</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm mb-2">
            <ChevronLeft size={16} />
            Back to Dashboard
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{form.title}</h1>
          <p className="text-white/40 text-sm sm:text-base">Analyzing {responses.length} responses from club members</p>
        </div>
        <button
          onClick={downloadCSV}
          disabled={responses.length === 0}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all disabled:opacity-50 w-full sm:w-auto"
        >
          <Download size={20} />
          Export CSV
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Submissions', value: responses.length, icon: <Users className="text-brand-accent" /> },
          { label: 'Completion Rate', value: '100%', icon: <BarChart3 className="text-blue-400" /> },
          { label: 'Last Response', value: responses.length > 0 ? new Date(responses[0].submittedAt).toLocaleDateString() : 'N/A', icon: <Calendar className="text-purple-400" /> }
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-3xl border border-white/10 bg-white/[0.02] flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
              {stat.icon}
            </div>
            <div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs font-medium text-white/40 uppercase tracking-widest">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search and Table */}
      <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <TableIcon className="text-brand-accent" size={24} />
            Response Data
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input
              type="text"
              placeholder="Filter responses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-accent/50"
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-8 px-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5">
                <th className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-white/20">Date</th>
                {form.fields.filter(f => f.type !== 'section').map(field => (
                  <th key={field.id} className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-white/20 min-w-[150px]">
                    {field.label}
                  </th>
                ))}
                <th className="py-4 px-4 text-xs font-bold uppercase tracking-widest text-white/20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredResponses.map((response) => (
                <tr key={response.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-4 text-sm text-white/40 whitespace-nowrap">
                    {new Date(response.submittedAt).toLocaleString()}
                  </td>
                  {form.fields.filter(f => f.type !== 'section').map(field => (
                    <td key={field.id} className="py-4 px-4 text-sm">
                      {Array.isArray(response.data[field.id]) 
                        ? (response.data[field.id] as string[]).join(', ') 
                        : response.data[field.id] || '-'}
                    </td>
                  ))}
                  <td className="py-4 px-4 text-right relative">
                    <button
                      onClick={(e) => {
                        console.log("Delete button clicked for:", response.id);
                        handleDeleteClick(response.id, e);
                      }}
                      className="relative z-10 flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-all cursor-pointer"
                      title="Delete Response"
                    >
                      <Trash2 size={16} />
                      <span className="text-xs font-bold uppercase">Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredResponses.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-white/20">No responses found matching your search</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {responseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="text-red-500" size={24} />
            </div>
            
            <h3 className="text-2xl font-bold text-center mb-2">Delete Response?</h3>
            <p className="text-white/40 text-center mb-8">
              This action cannot be undone. This will permanently remove this response from the database.
            </p>
            
            <div className="flex gap-4">
              <button
                onClick={() => setResponseToDelete(null)}
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
                  'Delete Permanently'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
