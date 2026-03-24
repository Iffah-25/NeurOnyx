import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FormStructure, FormField } from '../types';
import { sanitizeForFirestore } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Send, Loader2, Info, ExternalLink, Camera, Image as ImageIcon, X, ChevronDown, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Logo from '../components/Logo';
import SocialLinks from '../components/SocialLinks';

export default function FormView() {
  const { slug } = useParams();
  const [form, setForm] = useState<FormStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(0);

  const pages: FormField[][] = [];
  if (form) {
    let currentFields: FormField[] = [];
    form.fields.forEach(field => {
      if (field.type === 'section') {
        if (currentFields.length > 0) {
          pages.push(currentFields);
        }
        currentFields = [field];
      } else {
        currentFields.push(field);
      }
    });
    if (currentFields.length > 0 || pages.length === 0) {
      pages.push(currentFields);
    }
  }

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === pages.length - 1;

  const handleNext = async () => {
    const currentFields = pages[currentPage];
    for (const field of currentFields) {
      if (field.required) {
        const val = formData[field.id];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          setError(`${field.label} is required`);
          const element = document.getElementById(field.id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }

      // Domain restriction check
      if (form?.restrictToDomain && field.type === 'email') {
        const email = formData[field.id];
        if (email && !email.toLowerCase().endsWith('@aiktc.ac.in')) {
          setError('Only @aiktc.ac.in email addresses are allowed');
          const element = document.getElementById(field.id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }

      // Unique email check if limitOneResponse is active
      if (form?.limitOneResponse && field.type === 'email') {
        const email = formData[field.id];
        if (email) {
          try {
            const q = query(
              collection(db, 'responses'),
              where('formId', '==', form.id),
              where(`data.${field.id}`, '==', email.toLowerCase()),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setError('You have already submitted a response with this email address');
              const element = document.getElementById(field.id);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              return;
            }
          } catch (err) {
            console.error('Error checking unique email:', err);
          }
        }
      }
    }
    setError('');
    setCurrentPage(p => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setError('');
    setCurrentPage(p => p - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const q = query(collection(db, 'forms'), where('slug', '==', slug), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const data = doc.data() as FormStructure;
          setForm({ id: doc.id, ...data });

          if (data.limitOneResponse) {
            const hasSubmitted = localStorage.getItem(`submitted_${doc.id}`);
            if (hasSubmitted) {
              setAlreadySubmitted(true);
            }
          }
        } else {
          setLoadError('Form not found');
        }
      } catch (err) {
        console.error(err);
        setLoadError('Failed to load form');
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setSubmitting(true);
    setError('');

    try {
      // Basic validation for required fields
      for (const field of form.fields) {
        if (field.required) {
          const val = formData[field.id];
          if (!val || (Array.isArray(val) && val.length === 0)) {
            const errorMsg = `${field.label} is required`;
            setError(errorMsg);
            const element = document.getElementById(field.id);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            throw new Error(errorMsg);
          }
        }

        // Domain restriction check
        if (form.restrictToDomain && field.type === 'email') {
          const email = formData[field.id];
          if (email && !email.toLowerCase().endsWith('@aiktc.ac.in')) {
            const errorMsg = 'Only @aiktc.ac.in email addresses are allowed';
            setError(errorMsg);
            const element = document.getElementById(field.id);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            throw new Error(errorMsg);
          }
        }

        // Unique email check in database if limitOneResponse is active
        if (form.limitOneResponse && field.type === 'email') {
          const email = formData[field.id];
          if (email) {
            const q = query(
              collection(db, 'responses'),
              where('formId', '==', form.id),
              where(`data.${field.id}`, '==', email.toLowerCase()),
              limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setAlreadySubmitted(true);
              throw new Error('You have already submitted a response with this email address');
            }
          }
        }
      }

      // Sanitize email fields to lowercase for consistent checking
      const sanitizedData = { ...formData };
      form.fields.forEach(f => {
        if (f.type === 'email' && sanitizedData[f.id]) {
          sanitizedData[f.id] = sanitizedData[f.id].toLowerCase();
        }
      });

      await addDoc(collection(db, 'responses'), sanitizeForFirestore({
        formId: form.id,
        data: sanitizedData,
        submittedAt: Date.now(),
      }));

      if (form.limitOneResponse) {
        localStorage.setItem(`submitted_${form.id}`, 'true');
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to submit form');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (error) setError('');
  };

  const handleImageUpload = async (fieldId: string, file: File) => {
    if (file.size > 1024 * 1024) {
      alert('Image too large. Max 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      handleInputChange(fieldId, reader.result as string);
    };
  };

  if (loading) return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center space-y-8 relative overflow-hidden"
      style={{ backgroundColor: '#000814' }}
    >
      <div className="absolute inset-0 bg-brand-accent/5 blur-[100px] animate-pulse" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <Logo className="w-32 h-32" />
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold tracking-widest uppercase text-white">NeurOnyx</h2>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    </div>
  );

  if (!loading && (loadError || !form)) return (
    <div className="max-w-md mx-auto py-20 text-center space-y-6">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="text-red-500" size={40} />
      </div>
      <h2 className="text-3xl font-bold">Oops! {loadError || 'Form not found'}</h2>
      <p className="text-white/40">The form you're looking for might have been moved or deleted.</p>
    </div>
  );

  if (alreadySubmitted) return (
    <div className="max-w-xl mx-auto py-20 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-12 rounded-3xl border border-white/10 bg-white/[0.02] text-center space-y-6"
      >
        <div className="w-24 h-24 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Info className="text-brand-accent" size={48} />
        </div>
        <h2 className="text-4xl font-bold tracking-tight">Already Responded</h2>
        <p className="text-white/40 text-lg leading-relaxed">
          You have already submitted a response to this form. Only one submission is allowed per user.
        </p>
      </motion.div>
    </div>
  );

  if (submitted) return (
    <div className="max-w-xl mx-auto py-20 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-12 rounded-3xl border border-white/10 bg-white/[0.02] text-center space-y-8"
      >
        <div className="w-24 h-24 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="text-brand-accent" size={48} />
        </div>
        <h2 className="text-4xl font-bold tracking-tight">Submission Received!</h2>
        
        <div className="text-white/60 text-lg leading-relaxed prose prose-invert max-w-none">
          {form.successMessage ? (
            <ReactMarkdown>{form.successMessage}</ReactMarkdown>
          ) : (
            <p>Thank you for registering. We've received your response and will be in touch soon.</p>
          )}
        </div>

        <div className="py-6 border-t border-white/5 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Connect With Us</p>
          <div className="flex justify-center">
            <SocialLinks />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all w-full sm:w-auto"
          >
            Submit another response
          </button>
        </div>
      </motion.div>
    </div>
  );

  if (form && form.isOpen === false) return (
    <div className="max-w-xl mx-auto py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-12 rounded-3xl border border-white/10 bg-white/[0.02] text-center space-y-6"
      >
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="text-red-500" size={48} />
        </div>
        <h2 className="text-4xl font-bold tracking-tight">Registration Closed</h2>
        <p className="text-white/40 text-lg leading-relaxed">
          This form is no longer accepting responses. Please contact the organizer if you have any questions.
        </p>
      </motion.div>
    </div>
  );

  return (
    <div 
      className={`min-h-screen relative overflow-hidden ${form.theme?.fontFamily || 'font-sans'}`}
      style={{
        backgroundColor: form.theme?.backgroundColor || '#000814',
        '--color-brand-accent': form.theme?.accentColor || '#00d2ff',
        '--color-brand-bg': form.theme?.backgroundColor || '#000814',
      } as React.CSSProperties}
    >
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-accent/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/5 blur-[120px] rounded-full" />

      <div className="max-w-4xl mx-auto py-8 md:py-24 px-4 sm:px-6 relative z-10">
        <header className="space-y-6 md:space-y-8 mb-12 md:mb-16">
          <div className="flex items-center gap-2 text-brand-accent font-bold text-[10px] uppercase tracking-widest">
            <div className="w-4 h-px bg-brand-accent" />
            Registration Portal
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-7xl font-display font-bold tracking-tight leading-tight">
              {form.title}
            </h1>
            {form.description && (
              <div 
                className="text-white/40 text-base md:text-xl max-w-2xl leading-relaxed prose prose-invert prose-p:text-white/40 prose-headings:text-white/80 prose-strong:text-white/80 prose-a:text-brand-accent"
                dangerouslySetInnerHTML={{ __html: form.description }}
              />
            )}
          </div>

          {form.headerImage && (
            <div className="relative aspect-[21/9] rounded-[2rem] overflow-hidden glass">
              <img 
                src={form.headerImage} 
                alt={form.title} 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit} className="space-y-10 glass p-8 md:p-12 rounded-[2.5rem]">
          {error && (
            <div className="p-5 glass rounded-2xl border-red-500/20 text-red-400 text-sm flex items-center gap-3 mb-6">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {pages[currentPage]?.map((field, index) => (
            <div key={field.id} id={field.id} className="space-y-4 scroll-mt-24">
              {field.type === 'section' ? (
                <div className="mb-8 pb-4 border-b border-white/10">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{field.label}</h2>
                  {field.placeholder && (
                    <p className="text-white/40 mt-2 text-sm md:text-base">{field.placeholder}</p>
                  )}
                </div>
              ) : (
                <>
                  <label className="block text-lg font-bold tracking-tight text-white/80">
                    {field.label}
                    {field.required && <span className="text-brand-accent ml-1">*</span>}
                  </label>

                  <div className="relative">
                    {field.type === 'text' || field.type === 'email' || field.type === 'phone' ? (
                      <input
                        type={field.type === 'phone' ? 'tel' : field.type}
                        required={field.required}
                        placeholder={field.placeholder || 'Enter your response...'}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-accent/50 transition-all text-lg placeholder:text-white/5"
                      />
                    ) : field.type === 'paragraph' ? (
                      <textarea
                        required={field.required}
                        placeholder={field.placeholder || 'Type your response here...'}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-accent/50 transition-all text-lg min-h-[160px] resize-none placeholder:text-white/5 leading-relaxed"
                      />
                    ) : field.type === 'dropdown' ? (
                      <div className="relative">
                        <select
                          required={field.required}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 focus:outline-none focus:border-brand-accent/50 transition-all text-lg appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-brand-bg text-white/20">Select an option</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt} className="bg-brand-bg text-white">{opt}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" size={20} />
                      </div>
                    ) : field.type === 'single-choice' || field.type === 'multiple-choice' ? (
                      <div className="grid grid-cols-1 gap-3">
                        {field.options?.map((opt, i) => (
                          <label key={i} className="flex items-center justify-between p-5 glass rounded-2xl hover:bg-white/[0.05] cursor-pointer transition-all group/opt">
                            <span className="text-white/60 group-hover/opt:text-white transition-colors">{opt}</span>
                            <input
                              type="radio"
                              name={field.id}
                              required={field.required}
                              checked={formData[field.id] === opt}
                              onChange={() => handleInputChange(field.id, opt)}
                              className="w-5 h-5 border-white/20 bg-transparent text-brand-accent focus:ring-brand-accent/50"
                            />
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="grid grid-cols-1 gap-3">
                        {field.options?.map((opt, i) => (
                          <label key={i} className="flex items-center justify-between p-5 glass rounded-2xl hover:bg-white/[0.05] cursor-pointer transition-all group/opt">
                            <span className="text-white/60 group-hover/opt:text-white transition-colors">{opt}</span>
                            <input
                              type="checkbox"
                              checked={(formData[field.id] || []).includes(opt)}
                              onChange={(e) => {
                                const current = formData[field.id] || [];
                                const next = e.target.checked 
                                  ? [...current, opt]
                                  : current.filter((v: string) => v !== opt);
                                handleInputChange(field.id, next);
                              }}
                              className="w-5 h-5 rounded-lg border-white/20 bg-transparent text-brand-accent focus:ring-brand-accent/50"
                            />
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'file' ? (
                      <div className="relative group/file">
                        <input
                          type="file"
                          onChange={(e) => handleInputChange(field.id, e.target.files?.[0]?.name)}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div className="glass rounded-2xl p-10 text-center group-hover/file:bg-white/[0.05] transition-all">
                          <Upload className="mx-auto text-white/10 mb-4 group-hover/file:text-brand-accent transition-colors" size={32} />
                          <p className="text-sm text-white/20 group-hover/file:text-white/40 transition-colors">
                            {formData[field.id] || 'Click or drag to upload file'}
                          </p>
                        </div>
                      </div>
                    ) : field.type === 'image' ? (
                      <div className="space-y-4">
                        {field.imageUrl ? (
                          <div className="relative rounded-2xl overflow-hidden glass border border-white/10">
                            <img 
                              src={field.imageUrl} 
                              alt={field.label} 
                              className="w-full h-auto max-h-[500px] object-contain p-4" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="p-8 glass rounded-2xl text-center text-white/20 text-sm italic">
                            No image provided
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ))}

          {error && (
            <div className="p-5 glass rounded-2xl border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            {!isFirstPage && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-8 py-5 glass rounded-2xl font-bold hover:bg-white/10 transition-all flex-1 text-white/80"
              >
                Previous
              </button>
            )}
            
            {isLastPage ? (
              <button
                type="submit"
                disabled={submitting}
                className="group relative flex-[2] py-5 bg-brand-accent text-brand-bg font-bold rounded-2xl hover:bg-white transition-all accent-glow"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Response
                      <Send size={18} />
                    </>
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="group relative flex-[2] py-5 bg-brand-accent text-brand-bg font-bold rounded-2xl hover:bg-white transition-all accent-glow"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  Next Page
                </span>
              </button>
            )}
          </div>
        </form>

        <footer className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-20 hover:opacity-100 transition-opacity">
          <div className="text-[10px] font-bold uppercase tracking-widest">
            Powered by NeurOnyx
          </div>
          <SocialLinks />
          <div className="flex gap-6">
            <span className="text-[10px] font-bold uppercase tracking-widest">Secure Connection</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">Privacy Verified</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
