import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FormStructure, FormField } from '../types';
import { sanitizeForFirestore } from '../lib/utils';
import { uploadFileToGoogleDrive, ROOT_PARENT_FOLDER_URL } from '../lib/drive';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, AlertCircle, Send, Loader2, Info, ExternalLink, 
  Camera, Image as ImageIcon, X, ChevronDown, Upload, HardDrive, 
  MessageCircle, Maximize2, Minimize2, Clock, AlertTriangle, ShieldAlert
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Logo from '../components/Logo';
import SocialLinks from '../components/SocialLinks';
import FirebasePermissionError from '../components/FirebasePermissionError';

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
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  // Assessment & Proctoring States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const [tabSwitchWarningMessage, setTabSwitchWarningMessage] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [submissionReason, setSubmissionReason] = useState<string | null>(null);

  // References to avoid stale closures in event listeners and timers
  const formDataRef = React.useRef(formData);
  formDataRef.current = formData;

  const submittingRef = React.useRef(submitting);
  submittingRef.current = submitting;

  const submittedRef = React.useRef(submitted);
  submittedRef.current = submitted;

  const lastTabSwitchRef = React.useRef(0);


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
              where('formId', '==', form.id)
            );
            const querySnapshot = await getDocs(q);
            const exists = querySnapshot.docs.some(docSnap => {
              const resData = docSnap.data().data || {};
              return String(resData[field.id] || '').toLowerCase() === email.toLowerCase();
            });
            if (exists) {
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

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || submitting) {
        return;
      }
      e.preventDefault();
      if (!isLastPage) {
        handleNext();
      }
    }
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
      } catch (err: any) {
        console.error(err);
        setLoadError(err.message || 'Failed to load form');
      } finally {
        setLoading(false);
      }
    };
    fetchForm();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || submitting) return;

    // Check if any file is still uploading
    if (Object.values(uploadingFields).some(Boolean)) {
      setError('Please wait for file upload to complete before submitting.');
      return;
    }

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
              where('formId', '==', form.id)
            );
            const querySnapshot = await getDocs(q);
            const exists = querySnapshot.docs.some(docSnap => {
              const resData = docSnap.data().data || {};
              return String(resData[field.id] || '').toLowerCase() === email.toLowerCase();
            });
            if (exists) {
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

      sessionStorage.removeItem(`neuronyx_timer_start_${form.id}`);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to submit form');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit execution for tab switch limit or timer expiration
  const executeAutoSubmit = async (reason: string, finalSwitchesCount?: number) => {
    if (!form || submittingRef.current || submittedRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmissionReason(reason);
    setError('');

    try {
      const sanitizedData = { ...formDataRef.current };
      form.fields.forEach(f => {
        if (f.type === 'email' && sanitizedData[f.id]) {
          sanitizedData[f.id] = String(sanitizedData[f.id]).toLowerCase();
        }
      });

      await addDoc(collection(db, 'responses'), sanitizeForFirestore({
        formId: form.id,
        data: sanitizedData,
        submittedAt: Date.now(),
        submissionReason: reason,
        tabSwitchesCount: finalSwitchesCount !== undefined ? finalSwitchesCount : tabSwitches,
      }));

      if (form.limitOneResponse) {
        localStorage.setItem(`submitted_${form.id}`, 'true');
      }

      sessionStorage.removeItem(`neuronyx_timer_start_${form.id}`);
      submittedRef.current = true;
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Error during auto-submission:', err);
      submittedRef.current = true;
      setSubmitted(true);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Fullscreen management
  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setShowFullscreenPrompt(false);
      }
    } catch (err) {
      console.warn('Fullscreen request dismissed or blocked:', err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Fullscreen listeners and direct entry
  useEffect(() => {
    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);
      if (form?.enableFullscreen && !inFullscreen && !submitted && !alreadySubmitted && !loading) {
        setShowFullscreenPrompt(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [form?.enableFullscreen, submitted, alreadySubmitted, loading]);

  useEffect(() => {
    if (form?.enableFullscreen && !submitted && !alreadySubmitted && !loading) {
      if (!document.fullscreenElement) {
        enterFullscreen().catch(() => {
          setShowFullscreenPrompt(true);
        });
      }
    }
  }, [form?.enableFullscreen, loading, submitted, alreadySubmitted]);

  // Tab switch detection & auto-submit on 3 switches
  useEffect(() => {
    if (!form?.enableTabSwitchLimit || submitted || alreadySubmitted || loading) return;

    const maxSwitches = form.maxTabSwitches || 3;

    const handleTabSwitch = () => {
      if (submittedRef.current || submittingRef.current) return;
      const now = Date.now();
      // Debounce window blur and visibilitychange within 1.5 seconds
      if (now - lastTabSwitchRef.current < 1500) return;

      if (document.hidden || !document.hasFocus()) {
        lastTabSwitchRef.current = now;
        setTabSwitches(prev => {
          const next = prev + 1;
          if (next >= maxSwitches) {
            executeAutoSubmit(`Auto-submitted: Tab switches exceeded limit (${next}/${maxSwitches})`, next);
          } else {
            setTabSwitchWarningMessage(
              `Tab switch detected (${next}/${maxSwitches})! Leaving the form is not permitted. If you switch tabs ${maxSwitches - next} more time(s), your form will be automatically submitted!`
            );
            setShowTabSwitchWarning(true);
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleTabSwitch);
    window.addEventListener('blur', handleTabSwitch);

    return () => {
      document.removeEventListener('visibilitychange', handleTabSwitch);
      window.removeEventListener('blur', handleTabSwitch);
    };
  }, [form?.enableTabSwitchLimit, form?.maxTabSwitches, submitted, alreadySubmitted, loading]);

  // Live Timer Countdown & Auto-Submit
  useEffect(() => {
    if (!form?.timeLimitMinutes || form.timeLimitMinutes <= 0 || submitted || alreadySubmitted || loading) {
      return;
    }

    const storageKey = `neuronyx_timer_start_${form.id}`;
    let startTime = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
    if (!startTime) {
      startTime = Date.now();
      sessionStorage.setItem(storageKey, String(startTime));
    }

    const totalSeconds = form.timeLimitMinutes * 60;

    const updateTimer = () => {
      if (submittedRef.current || submittingRef.current) return;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        executeAutoSubmit('Auto-submitted: Time limit expired');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [form?.id, form?.timeLimitMinutes, submitted, alreadySubmitted, loading]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (error) setError('');
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('File is too large. Maximum allowed size is 20MB.');
      return;
    }

    setUploadingFields(prev => ({ ...prev, [fieldId]: true }));

    try {
      // Upload directly to Google Drive folder for this form
      const driveResult = await uploadFileToGoogleDrive(
        file,
        form?.title || 'Form Submissions'
      );

      handleInputChange(fieldId, {
        name: file.name,
        url: driveResult.webViewLink,
        driveFileId: driveResult.id,
        driveFolderUrl: driveResult.driveFolderUrl,
        size: file.size,
        type: file.type,
        isDrive: true
      });
    } catch (err: any) {
      console.warn('Google Drive upload error, falling back to embedded link:', err);
      // Fallback to local DataURL preview if Drive upload encounters any issue
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        handleInputChange(fieldId, {
          name: file.name,
          url: result,
          size: file.size,
          type: file.type,
          isDrive: false
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingFields(prev => ({ ...prev, [fieldId]: false }));
    }
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
    <div className="max-w-2xl mx-auto py-20 text-center space-y-6 px-4">
      {loadError?.toLowerCase().includes('permission') || loadError?.toLowerCase().includes('denied') ? (
        <FirebasePermissionError error={loadError} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <h2 className="text-3xl font-bold">Oops! {loadError || 'Form not found'}</h2>
          <p className="text-white/40">The form you're looking for might have been moved or deleted.</p>
        </>
      )}
    </div>
  );

  if (alreadySubmitted) return (
    <div className="max-w-xl mx-auto py-10 sm:py-20 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 sm:p-12 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.02] text-center space-y-6"
      >
        <div className="flex justify-center mb-2">
          <Logo className="w-16 h-16" />
        </div>
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Info className="text-brand-accent" size={36} />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Already Responded</h2>
        <p className="text-white/40 text-base sm:text-lg leading-relaxed">
          You have already submitted a response to this form. Only one submission is allowed per user.
        </p>
      </motion.div>
    </div>
  );

  if (submitted) return (
    <div className="max-w-xl mx-auto py-10 sm:py-20 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 sm:p-12 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.02] text-center space-y-6 sm:space-y-8"
      >
        <div className="flex justify-center mb-2">
          <Logo className="w-16 h-16 sm:w-20 sm:h-20" />
        </div>
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="text-brand-accent" size={36} />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Submission Received!</h2>

        {/* Notice if auto-submitted due to tab switches or timer */}
        {submissionReason && (
          <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex items-start gap-3.5 text-left">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-amber-300">Notice Regarding Submission</p>
              <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">{submissionReason}</p>
            </div>
          </div>
        )}
        
        <div className="text-white/60 text-base sm:text-lg leading-relaxed prose prose-invert max-w-none">
          {form?.successMessage ? (
            <ReactMarkdown>{form.successMessage}</ReactMarkdown>
          ) : (
            <p>Thank you for registering. We've received your response and will be in touch soon.</p>
          )}
        </div>

        {/* WhatsApp / Action Link Box */}
        {form?.ctaLinkUrl && form.ctaLinkUrl.trim() !== '' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 sm:p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-left space-y-4 shadow-xl backdrop-blur-md relative overflow-hidden group"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle size={24} />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h4 className="text-base sm:text-lg font-bold text-white flex flex-wrap items-center gap-2">
                  <span>{form.ctaButtonText || 'Join WhatsApp Group'}</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Official Link</span>
                </h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  {form.ctaDescription || 'Join our official group for updates, announcements, and quick discussions.'}
                </p>
              </div>
            </div>

            <a
              href={form.ctaLinkUrl.startsWith('http') ? form.ctaLinkUrl : `https://${form.ctaLinkUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full py-3.5 px-6 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 active:scale-[0.98] transition-all shadow-lg cursor-pointer text-sm sm:text-base"
            >
              <span>{form.ctaButtonText || 'Join WhatsApp Group'}</span>
              <ExternalLink size={18} />
            </a>
          </motion.div>
        )}

        <div className="py-6 border-t border-white/5 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Connect With Us</p>
          <div className="flex justify-center">
            <SocialLinks />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all w-full sm:w-auto text-sm sm:text-base"
          >
            Submit another response
          </button>
        </div>
      </motion.div>
    </div>
  );

  if (form && form.isOpen === false) return (
    <div className="max-w-xl mx-auto py-10 sm:py-20 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 sm:p-12 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.02] text-center space-y-6"
      >
        <div className="flex justify-center mb-2">
          <Logo className="w-16 h-16" />
        </div>
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="text-red-500" size={36} />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Registration Closed</h2>
        <p className="text-white/40 text-base sm:text-lg leading-relaxed">
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

      {/* Sticky Countdown Timer Bar */}
      {timeRemaining !== null && !submitted && !alreadySubmitted && (
        <div className="sticky top-2 sm:top-4 z-40 px-3 sm:px-4 mb-2 flex justify-center">
          <div className={`w-full max-w-sm sm:max-w-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl sm:rounded-full border backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 transition-all ${
            timeRemaining < 60
              ? 'bg-red-500/25 border-red-500/60 text-red-100 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.5)]'
              : timeRemaining < 300
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
              : 'bg-brand-bg/95 border-brand-accent/40 text-white shadow-[0_0_20px_rgba(0,210,255,0.2)]'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <Clock size={16} className={`shrink-0 ${timeRemaining < 60 ? 'text-red-400 animate-spin' : timeRemaining < 300 ? 'text-amber-400' : 'text-brand-accent'}`} />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">
                {timeRemaining < 60 ? 'Hurry! Ending Soon:' : 'Time Left:'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-mono text-sm sm:text-base font-black tracking-widest px-2.5 py-0.5 rounded-lg bg-black/60 border border-white/10">
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto py-6 sm:py-12 md:py-20 px-3 sm:px-6 relative z-10">
        {/* Form Top Navigation / Logo Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-white/10 mb-6 sm:mb-10">
          <Link to="/" className="flex items-center gap-3 group">
            <Logo className="w-9 h-9 sm:w-11 sm:h-11 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-bold tracking-[0.2em] text-white group-hover:text-brand-accent transition-colors">
                NEURONYX
              </span>
              <span className="text-[9px] sm:text-[10px] text-white/40 tracking-wider uppercase font-mono">
                AIKTC ACM Chapter
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
            {form.enableFullscreen && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 sm:px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 transition-all cursor-pointer"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={13} className="text-sky-400" /> : <Maximize2 size={13} className="text-sky-400" />}
                <span className="hidden xs:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
            )}

            {form.enableTabSwitchLimit && (
              <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 sm:px-3 py-1.5 rounded-full border ${
                tabSwitches > 0 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}>
                <AlertTriangle size={13} className={tabSwitches > 0 ? 'text-amber-400 animate-pulse' : 'text-white/40'} />
                <span>Switches: {tabSwitches}/{form.maxTabSwitches || 3}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-brand-accent font-bold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 shadow-[0_0_15px_rgba(0,210,255,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
              Registration Portal
            </div>
          </div>
        </div>

        <header className="space-y-4 sm:space-y-6 md:space-y-8 mb-8 sm:mb-12 md:mb-16">
          <div className="flex items-center gap-2 text-brand-accent font-bold text-[10px] uppercase tracking-widest">
            <div className="w-4 h-px bg-brand-accent" />
            Registration Portal
          </div>
          
          <div className="space-y-3 sm:space-y-4">
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-display font-bold tracking-tight leading-tight break-words">
              {form.title}
            </h1>
            {form.description && (
              <div 
                className="text-white/50 text-sm sm:text-base md:text-lg max-w-2xl leading-relaxed prose prose-invert prose-p:text-white/50 prose-headings:text-white/80 prose-strong:text-white/80 prose-a:text-brand-accent break-words"
                dangerouslySetInnerHTML={{ __html: form.description }}
              />
            )}
          </div>

          {form.headerImage && (
            <div className="relative aspect-[21/9] rounded-xl sm:rounded-[2rem] overflow-hidden glass">
              <img 
                src={form.headerImage} 
                alt={form.title} 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6 sm:space-y-10 glass p-4 sm:p-8 md:p-12 rounded-2xl sm:rounded-[2.5rem]">
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
                  <label className="block text-base sm:text-lg font-bold tracking-tight text-white/90">
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
                        className="w-full bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 px-4 sm:px-6 focus:outline-none focus:border-brand-accent/50 transition-all text-base sm:text-lg placeholder:text-white/10"
                      />
                    ) : field.type === 'paragraph' ? (
                      <textarea
                        required={field.required}
                        placeholder={field.placeholder || 'Type your response here...'}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 px-4 sm:px-6 focus:outline-none focus:border-brand-accent/50 transition-all text-base sm:text-lg min-h-[130px] sm:min-h-[160px] resize-none placeholder:text-white/10 leading-relaxed"
                      />
                    ) : field.type === 'dropdown' ? (
                      <div className="relative">
                        <select
                          required={field.required}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className="w-full bg-white/[0.02] border border-white/5 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 px-4 sm:px-6 focus:outline-none focus:border-brand-accent/50 transition-all text-base sm:text-lg appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-brand-bg text-white/40">Select an option</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt} className="bg-brand-bg text-white">{opt}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" size={20} />
                      </div>
                    ) : field.type === 'single-choice' || field.type === 'multiple-choice' ? (
                      <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                        {field.options?.map((opt, i) => (
                          <label key={i} className="flex items-center justify-between p-3.5 sm:p-5 glass rounded-xl sm:rounded-2xl hover:bg-white/[0.05] cursor-pointer transition-all group/opt gap-3">
                            <span className="text-sm sm:text-base text-white/70 group-hover/opt:text-white transition-colors break-words">{opt}</span>
                            <input
                              type="radio"
                              name={field.id}
                              required={field.required}
                              checked={formData[field.id] === opt}
                              onChange={() => handleInputChange(field.id, opt)}
                              className="w-5 h-5 border-white/20 bg-transparent text-brand-accent focus:ring-brand-accent/50 shrink-0"
                            />
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                        {field.options?.map((opt, i) => (
                          <label key={i} className="flex items-center justify-between p-3.5 sm:p-5 glass rounded-xl sm:rounded-2xl hover:bg-white/[0.05] cursor-pointer transition-all group/opt gap-3">
                            <span className="text-sm sm:text-base text-white/70 group-hover/opt:text-white transition-colors break-words">{opt}</span>
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
                              className="w-5 h-5 rounded-lg border-white/20 bg-transparent text-brand-accent focus:ring-brand-accent/50 shrink-0"
                            />
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'file' ? (
                      <div className="relative group/file">
                        <input
                          type="file"
                          disabled={uploadingFields[field.id]}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(field.id, file);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                        />
                        <div className="glass rounded-2xl p-8 text-center group-hover/file:bg-white/[0.05] transition-all flex flex-col items-center justify-center gap-3">
                          {uploadingFields[field.id] ? (
                            <>
                              <Loader2 className="animate-spin text-brand-accent" size={32} />
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-white">Uploading file to Google Drive...</p>
                                <p className="text-xs text-brand-accent/80 font-mono">
                                  Folder: "{form?.title || 'Form Submissions'}"
                                </p>
                              </div>
                            </>
                          ) : formData[field.id] ? (
                            <>
                              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                                <HardDrive size={28} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-white">
                                  {formData[field.id].name || formData[field.id]}
                                </p>
                                <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
                                  <span>{formData[field.id].isDrive ? 'Saved to Google Drive' : 'File attached'}</span>
                                  {formData[field.id].size && (
                                    <span>({(formData[field.id].size / 1024).toFixed(1)} KB)</span>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="text-white/20 group-hover/file:text-brand-accent transition-colors" size={32} />
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-white/80">
                                  Click or drag to upload file
                                </p>
                                <p className="text-xs text-white/40">
                                  Files will be automatically stored in Google Drive
                                </p>
                              </div>
                            </>
                          )}
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

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-6">
            {!isFirstPage && (
              <button
                type="button"
                onClick={handlePrev}
                disabled={submitting}
                className="w-full sm:flex-1 py-3.5 sm:py-5 px-6 sm:px-8 glass rounded-xl sm:rounded-2xl font-bold hover:bg-white/10 transition-all text-white/80 disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                Previous
              </button>
            )}
            
            {isLastPage ? (
              <button
                type="submit"
                disabled={submitting}
                className={`w-full sm:flex-[2] py-3.5 sm:py-5 px-6 sm:px-8 font-bold rounded-xl sm:rounded-2xl transition-all text-sm sm:text-base ${
                  submitting
                    ? 'bg-brand-accent/50 text-brand-bg/90 cursor-not-allowed pointer-events-none'
                    : 'bg-brand-accent text-brand-bg hover:bg-white active:scale-[0.99] accent-glow cursor-pointer'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-3">
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin text-brand-bg shrink-0" size={20} />
                      <span className="tracking-wide font-extrabold text-sm sm:text-base">Submitting Response...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Response</span>
                      <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={submitting}
                className="w-full sm:flex-[2] py-3.5 sm:py-5 px-6 sm:px-8 bg-brand-accent text-brand-bg font-bold rounded-xl sm:rounded-2xl hover:bg-white transition-all accent-glow disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  Next Page
                </span>
              </button>
            )}
          </div>
        </form>

        <footer className="mt-16 sm:mt-24 pt-8 sm:pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
            <Logo className="w-5 h-5 inline-block" />
            Powered by NeurOnyx
          </div>
          <SocialLinks />
          <div className="flex gap-4 sm:gap-6 text-white/40 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
            <span>Secure Connection</span>
            <span>Privacy Verified</span>
          </div>
        </footer>
      </div>

      {/* Tab Switch Warning Modal */}
      <AnimatePresence>
        {showTabSwitchWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-[#050e1d] border border-amber-500/40 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center space-y-5 sm:space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] relative"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                <AlertTriangle size={30} className="animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                  Proctoring Violation
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-1">
                  Tab Switch Detected!
                </h3>
                <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                  {tabSwitchWarningMessage}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/60 flex items-center justify-between">
                <span>Tab Switches Used:</span>
                <span className="font-mono font-bold text-amber-400 text-sm sm:text-base">
                  {tabSwitches} / {form?.maxTabSwitches || 3}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowTabSwitchWarning(false)}
                className="w-full py-3 sm:py-3.5 px-6 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 active:scale-[0.98] transition-all cursor-pointer shadow-lg text-sm sm:text-base"
              >
                I Understand, Return to Form
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Required Modal */}
      <AnimatePresence>
        {showFullscreenPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-[#050e1d] border border-brand-accent/40 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center space-y-5 sm:space-y-6 shadow-[0_0_50px_rgba(0,210,255,0.25)] relative"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-brand-accent/20 text-brand-accent flex items-center justify-center mx-auto border border-brand-accent/30">
                <Maximize2 size={30} />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent px-3 py-1 rounded-full bg-brand-accent/10 border border-brand-accent/20">
                  Assessment Mode
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-1">
                  Fullscreen Mode Required
                </h3>
                <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                  This form is set to run in full-screen assessment mode to ensure an uninterrupted experience.
                </p>
              </div>

              <button
                type="button"
                onClick={enterFullscreen}
                className="w-full py-3.5 px-6 rounded-xl bg-brand-accent text-brand-bg font-bold hover:bg-white active:scale-[0.98] transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Maximize2 size={18} />
                <span>Enter Fullscreen</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
