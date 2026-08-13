import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { FormField, FormStructure, FieldType } from '../types';
import { sanitizeForFirestore } from '../lib/utils';
import { motion, Reorder, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, GripVertical, Settings2, Save, X, 
  Type, Mail, Phone, ChevronDown, List, CheckSquare, AlignLeft, Upload, 
  ChevronLeft, Layout, Image as ImageIcon, Camera, CircleDot, Palette,
  Bold, Italic, List as ListIcon, LayoutTemplate, MessageCircle, Link2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import RichTextEditor from '../components/RichTextEditor';
import FirebasePermissionError from '../components/FirebasePermissionError';

const FIELD_ICONS: Record<FieldType, any> = {
  text: <Type size={18} />,
  email: <Mail size={18} />,
  phone: <Phone size={18} />,
  dropdown: <ChevronDown size={18} />,
  'single-choice': <CircleDot size={18} />,
  'multiple-choice': <List size={18} />,
  checkbox: <CheckSquare size={18} />,
  paragraph: <AlignLeft size={18} />,
  file: <Upload size={18} />,
  image: <ImageIcon size={18} />,
  section: <LayoutTemplate size={18} />,
};

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [headerImage, setHeaderImage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [ctaLinkUrl, setCtaLinkUrl] = useState('');
  const [ctaButtonText, setCtaButtonText] = useState('');
  const [ctaDescription, setCtaDescription] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [limitOneResponse, setLimitOneResponse] = useState(false);
  const [restrictToDomain, setRestrictToDomain] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setTheme] = useState({
    fontFamily: 'font-sans',
    accentColor: '#00d2ff',
    backgroundColor: '#000814'
  });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('Image too large. Please select an image under 1MB.');
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setHeaderImage(base64);
      } catch (err) {
        console.error(err);
        alert('Error uploading image');
      }
    }
  };

  const handleFieldImageUpload = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('Image too large. Please select an image under 1MB.');
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        updateField(fieldId, { imageUrl: base64 });
      } catch (err) {
        console.error(err);
        alert('Error uploading image');
      }
    }
  };

  useEffect(() => {
    if (id) {
      const fetchForm = async () => {
        try {
          const docRef = doc(db, 'forms', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as FormStructure;
            setTitle(data.title);
            setDescription(data.description);
            setFields(data.fields);
            setHeaderImage(data.headerImage || '');
            setSuccessMessage(data.successMessage || '');
            setCtaLinkUrl(data.ctaLinkUrl || '');
            setCtaButtonText(data.ctaButtonText || '');
            setCtaDescription(data.ctaDescription || '');
            setIsOpen(data.isOpen !== undefined ? data.isOpen : true);
            setLimitOneResponse(data.limitOneResponse || false);
            setRestrictToDomain(data.restrictToDomain || false);
            if (data.theme) {
              setTheme(data.theme);
            }
          }
        } catch (err) {
          console.error("Error fetching form:", err);
          alert("Failed to load form details.");
        } finally {
          setLoading(false);
        }
      };
      fetchForm();
    }
  }, [id]);

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: uuidv4(),
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      required: false,
      placeholder: '',
      options: ['dropdown', 'single-choice', 'multiple-choice', 'checkbox'].includes(type) ? ['Option 1'] : undefined,
    };
    setFields([...fields, newField]);
    
    // Scroll to the new field after a short delay to allow rendering
    setTimeout(() => {
      const element = document.getElementById(`field-${newField.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a highlight effect
        element.classList.add('ring-2', 'ring-brand-accent');
        setTimeout(() => element.classList.remove('ring-2', 'ring-brand-accent'), 2000);
      }
    }, 100);
  };

  const removeField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const addOption = (fieldId: string) => {
    setFields(fields.map(f => {
      if (f.id === fieldId && f.options) {
        return { ...f, options: [...f.options, `Option ${f.options.length + 1}`] };
      }
      return f;
    }));
  };

  const updateOption = (fieldId: string, index: number, value: string) => {
    setFields(fields.map(f => {
      if (f.id === fieldId && f.options) {
        const newOptions = [...f.options];
        newOptions[index] = value;
        return { ...f, options: newOptions };
      }
      return f;
    }));
  };

  const removeOption = (fieldId: string, index: number) => {
    setFields(fields.map(f => {
      if (f.id === fieldId && f.options) {
        return { ...f, options: f.options.filter((_, i) => i !== index) };
      }
      return f;
    }));
  };

  const handleSave = async () => {
    if (!title) return alert('Please enter a form title');
    if (fields.length === 0) return alert('Please add at least one field');
    
    setSaving(true);
    setSaveError(null);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const formData = sanitizeForFirestore({
        title,
        description,
        fields,
        headerImage,
        successMessage,
        ctaLinkUrl,
        ctaButtonText,
        ctaDescription,
        isOpen,
        limitOneResponse,
        restrictToDomain,
        theme,
        updatedAt: Date.now(),
        slug: slug || uuidv4().slice(0, 8),
      });

      if (id) {
        await updateDoc(doc(db, 'forms', id), formData);
      } else {
        await addDoc(collection(db, 'forms'), {
          ...formData,
          createdAt: Date.now(),
          createdBy: auth.currentUser?.uid || 'anonymous',
        });
      }
      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || 'Error saving form');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div 
      className={`min-h-screen pb-32 ${theme.fontFamily}`}
      style={{
        backgroundColor: theme.backgroundColor,
        '--color-brand-accent': theme.accentColor,
        '--color-brand-bg': theme.backgroundColor,
      } as React.CSSProperties}
    >
      <div className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/5 pb-12">
          <div className="space-y-4">
            <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-brand-accent font-bold text-[10px] uppercase tracking-widest hover:translate-x-[-4px] transition-transform">
              <ChevronLeft size={14} />
              Back to Dashboard
            </button>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold tracking-tight">
              Form <span className="text-brand-accent">Architect</span>
            </h1>
            <p className="text-white/40 text-sm sm:text-base">Design high-performance neural data collection interfaces.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-brand-accent text-brand-bg font-bold rounded-2xl hover:bg-white transition-all accent-glow w-full sm:w-auto"
          >
            <Save size={24} />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        {saveError && (
          <FirebasePermissionError error={saveError} />
        )}

        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {/* Desktop Field Toolbar */}
            <div className="hidden md:flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-brand-accent font-bold text-[10px] uppercase tracking-widest shrink-0 mr-2">
                <div className="w-4 h-px bg-brand-accent" />
                Add Field
              </div>
              {(Object.keys(FIELD_ICONS) as FieldType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => addField(type)}
                  className="flex items-center gap-3 px-4 py-2.5 glass rounded-xl hover:bg-brand-accent hover:text-brand-bg transition-all group whitespace-nowrap"
                >
                  <div className="text-white/40 group-hover:text-brand-bg transition-colors scale-90">
                    {FIELD_ICONS[type]}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{type.replace('-', ' ')}</span>
                </button>
              ))}
              
              <div className="w-px h-8 bg-white/10 mx-2" />
              
              <button
                onClick={() => setThemeOpen(true)}
                className="flex items-center gap-3 px-4 py-2.5 glass rounded-xl hover:bg-brand-accent hover:text-brand-bg transition-all group whitespace-nowrap"
              >
                <Palette size={18} className="text-white/40 group-hover:text-brand-bg transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Theme</span>
              </button>

              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-brand-accent/10 border border-brand-accent/20 hover:bg-brand-accent hover:text-brand-bg transition-all group whitespace-nowrap backdrop-blur-md"
              >
                <Settings2 size={18} className="text-brand-accent group-hover:text-brand-bg transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent group-hover:text-brand-bg transition-colors">Settings</span>
              </button>
            </div>

            {/* Header Editor */}
            <div className="p-8 md:p-12 glass rounded-[2.5rem] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent/20" />
              
              {/* Header Image Background */}
              {headerImage && (
                <div className="absolute inset-0 z-0">
                  <img src={headerImage} alt="Header" className="w-full h-full object-cover opacity-20" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-b from-brand-bg/80 to-brand-bg" />
                </div>
              )}

              <div className="relative z-10 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-6">
                    <input
                      type="text"
                      placeholder="Form Title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-transparent text-4xl md:text-5xl font-display font-bold tracking-tight focus:outline-none placeholder:text-white/5"
                    />
                    <div className="quill-dark">
                      <RichTextEditor
                        value={description}
                        onChange={setDescription}
                        placeholder="Enter a description for your respondents..."
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="relative group/image">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleHeaderImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <button className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/20 hover:text-brand-accent hover:bg-brand-accent/10 transition-all">
                        <ImageIcon size={20} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => setSettingsOpen(true)}
                      className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/20 hover:text-brand-accent hover:bg-brand-accent/10 transition-all md:hidden"
                    >
                      <Settings2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Fields Editor */}
            <Reorder.Group axis="y" values={fields} onReorder={setFields} className="space-y-6">
              {fields.map((field, index) => (
                <Reorder.Item
                  key={field.id}
                  id={`field-${field.id}`}
                  value={field}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-[2rem] group relative overflow-hidden transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row items-stretch">
                    <div className="w-full md:w-12 border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col items-center justify-between md:justify-start p-4 md:py-8 gap-4 bg-white/[0.01]">
                      <div className="cursor-grab active:cursor-grabbing text-white/20 hover:text-brand-accent transition-colors">
                        <GripVertical size={20} />
                      </div>
                      <span className="font-bold text-[10px] text-white/10 uppercase tracking-widest">#{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    
                    <div className="flex-1 p-6 md:p-10 space-y-8">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-brand-accent">
                            {FIELD_ICONS[field.type]}
                          </div>
                          <div className="space-y-0.5">
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-white/20">Field Type</span>
                            <span className="block font-bold uppercase text-xs tracking-widest text-brand-accent">{field.type.replace('-', ' ')}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-8">
                          {field.type !== 'section' && (
                            <label className="flex items-center gap-3 cursor-pointer group/toggle">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 group-hover/toggle:text-white/40 transition-colors">Required</span>
                              <div 
                                onClick={() => updateField(field.id, { required: !field.required })}
                                className={`w-10 h-5 rounded-full transition-colors relative ${field.required ? 'bg-brand-accent' : 'bg-white/10'}`}
                              >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${field.required ? 'left-6' : 'left-1'}`} />
                              </div>
                            </label>
                          )}
                          <button
                            onClick={() => removeField(field.id)}
                            className="w-10 h-10 glass rounded-xl flex items-center justify-center text-white/20 hover:text-red-500 hover:border-red-500/50 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="relative">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            className="w-full bg-transparent text-xl md:text-2xl font-bold tracking-tight focus:outline-none border-b border-white/5 focus:border-brand-accent/50 transition-colors pb-3"
                            placeholder={field.type === 'section' ? "Section Title" : "Field Label"}
                          />
                        </div>

                        {['text', 'email', 'phone', 'paragraph', 'section'].includes(field.type) && (
                          <input
                            type="text"
                            value={field.placeholder}
                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-brand-accent/30 placeholder:text-white/5"
                            placeholder={field.type === 'section' ? "Section description (optional)..." : "Placeholder text..."}
                          />
                        )}

                        {field.type === 'image' && (
                          <div className="space-y-4">
                            <div className="relative group">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFieldImageUpload(field.id, e)}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                              />
                              <div className="w-full aspect-video glass rounded-2xl flex flex-col items-center justify-center gap-4 group-hover:bg-white/[0.05] transition-all overflow-hidden relative border border-dashed border-white/10">
                                {field.imageUrl ? (
                                  <>
                                    <img src={field.imageUrl} alt="Field Preview" className="absolute inset-0 w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <div className="flex flex-col items-center gap-2">
                                        <Camera size={24} className="text-white" />
                                        <span className="text-white font-bold uppercase text-[10px] tracking-widest bg-brand-bg/80 px-3 py-1 rounded-lg">Change Image</span>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon size={32} className="text-white/10" />
                                    <div className="text-center">
                                      <span className="block text-white/20 font-bold uppercase text-[10px] tracking-widest">Upload Image</span>
                                      <span className="block text-white/10 text-[10px] mt-1">Supports QR codes, payment details, etc.</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {field.options && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {field.options.map((option, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-4 glass rounded-2xl group/opt">
                                <span className="text-[10px] font-bold text-white/20">{String(idx + 1).padStart(2, '0')}</span>
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => updateOption(field.id, idx, e.target.value)}
                                  className="flex-1 bg-transparent focus:outline-none text-sm font-medium"
                                />
                                <button
                                  onClick={() => removeOption(field.id, idx)}
                                  className="text-white/10 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 transition-all"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addOption(field.id)}
                              className="flex items-center justify-center gap-2 p-4 border border-dashed border-white/10 rounded-2xl text-brand-accent hover:bg-brand-accent/5 transition-all text-[10px] font-bold uppercase tracking-widest"
                            >
                              <Plus size={14} /> Add Option
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {fields.length === 0 && (
              <div className="py-32 text-center glass rounded-[3rem]">
                <Layout className="mx-auto text-white/5 mb-6" size={64} />
                <h3 className="text-2xl font-bold text-white/20">No fields added yet</h3>
                <p className="text-white/10 text-sm mt-2">Select a field type from the toolbar to start building.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Theme Settings Modal */}
      <AnimatePresence>
        {themeOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setThemeOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-6"
            >
              <div className="bg-brand-bg border border-white/10 rounded-[2rem] p-8 w-full max-w-lg pointer-events-auto shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent" />
                
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <Palette className="text-brand-accent" size={24} />
                    Theme Settings
                  </h3>
                  <button 
                    onClick={() => setThemeOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Font Family</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['font-sans', 'font-serif', 'font-display'].map((font) => (
                        <button
                          key={font}
                          onClick={() => setTheme({ ...theme, fontFamily: font })}
                          className={`p-4 rounded-xl border transition-all ${theme.fontFamily === font ? 'bg-brand-accent/10 border-brand-accent text-brand-accent' : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]'}`}
                        >
                          <span className={`text-lg ${font}`}>Aa</span>
                          <span className="block text-[10px] uppercase tracking-widest mt-2">{font.replace('font-', '')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Accent Color</label>
                    <div className="grid grid-cols-5 gap-3">
                      {['#00d2ff', '#ff0055', '#00ff9d', '#ffaa00', '#a855f7'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setTheme({ ...theme, accentColor: color })}
                          className={`w-full aspect-square rounded-xl border transition-all relative group ${theme.accentColor === color ? 'border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                        >
                          {theme.accentColor === color && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Background Color</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['#000814', '#0f172a', '#18181b'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setTheme({ ...theme, backgroundColor: color })}
                          className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${theme.backgroundColor === color ? 'bg-white/10 border-brand-accent' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'}`}
                        >
                          <div className="w-8 h-8 rounded-full border border-white/10" style={{ backgroundColor: color }} />
                          <span className="text-[10px] uppercase tracking-widest text-white/40">{color}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-6"
            >
              <div className="bg-brand-bg border border-white/10 rounded-[2rem] p-8 w-full max-w-lg pointer-events-auto shadow-2xl relative max-h-[85vh] overflow-y-auto">
                <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent" />
                
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-brand-bg/95 backdrop-blur-md pt-2 pb-2 z-10">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <Settings2 className="text-brand-accent" size={24} />
                    Form Settings
                  </h3>
                  <button 
                    onClick={() => setSettingsOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Success Message</label>
                    <textarea
                      placeholder="Enter a message to show after submission..."
                      value={successMessage}
                      onChange={(e) => setSuccessMessage(e.target.value)}
                      className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-5 text-sm focus:outline-none focus:border-brand-accent/30 h-28 resize-none placeholder:text-white/5 leading-relaxed"
                    />
                  </div>

                  {/* Post-Submission WhatsApp / CTA Group Link Box */}
                  <div className="space-y-4 p-5 glass rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02]">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="text-emerald-400" size={18} />
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        WhatsApp / Action Link Box (Optional)
                      </label>
                    </div>
                    <p className="text-xs text-white/50">
                      Add a WhatsApp group link or custom URL to display a prominent action box on the Thank You screen after submission.
                    </p>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="block text-[10px] text-white/40 uppercase mb-1 font-semibold">
                          Link URL (e.g. WhatsApp Group Link)
                        </label>
                        <div className="relative">
                          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                          <input
                            type="url"
                            placeholder="https://chat.whatsapp.com/..."
                            value={ctaLinkUrl}
                            onChange={(e) => setCtaLinkUrl(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-400/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-white/40 uppercase mb-1 font-semibold">
                          Button Text
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Join WhatsApp Group"
                          value={ctaButtonText}
                          onChange={(e) => setCtaButtonText(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400/50"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-white/40 uppercase mb-1 font-semibold">
                          Box Description
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Join our official WhatsApp group for instant updates!"
                          value={ctaDescription}
                          onChange={(e) => setCtaDescription(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 glass rounded-2xl">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Form Status</label>
                        <p className={`text-sm font-bold ${isOpen ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isOpen ? 'Accepting Responses' : 'Closed'}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${isOpen ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}
                      >
                        <div className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isOpen ? 'translate-x-7' : 'translate-x-2'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-5 glass rounded-2xl">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Response Limit</label>
                        <p className={`text-sm font-bold ${limitOneResponse ? 'text-brand-accent' : 'text-white/60'}`}>
                          {limitOneResponse ? 'One response per user' : 'Unlimited responses'}
                        </p>
                      </div>
                      <button
                        onClick={() => setLimitOneResponse(!limitOneResponse)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${limitOneResponse ? 'bg-brand-accent/20' : 'bg-white/10'}`}
                      >
                        <div className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${limitOneResponse ? 'translate-x-7' : 'translate-x-2'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-5 glass rounded-2xl">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40">Domain Restriction</label>
                        <p className={`text-sm font-bold ${restrictToDomain ? 'text-brand-accent' : 'text-white/60'}`}>
                          {restrictToDomain ? 'Restrict to @aiktc.ac.in' : 'No domain restriction'}
                        </p>
                      </div>
                      <button
                        onClick={() => setRestrictToDomain(!restrictToDomain)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${restrictToDomain ? 'bg-brand-accent/20' : 'bg-white/10'}`}
                      >
                        <div className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${restrictToDomain ? 'translate-x-7' : 'translate-x-2'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Add Field FAB */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="w-14 h-14 bg-brand-accent text-brand-bg rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Mobile Field Selection Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-brand-bg border-t border-white/10 rounded-t-[2rem] p-6 z-50 md:hidden max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-8" />
              <h3 className="text-xl font-bold mb-6 px-2">Add Field</h3>
              <div className="grid grid-cols-2 gap-3 pb-8">
                {(Object.keys(FIELD_ICONS) as FieldType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      addField(type);
                      setMobileMenuOpen(false);
                    }}
                    className="flex flex-col items-center justify-center gap-3 p-6 glass rounded-2xl hover:bg-white/[0.05] active:scale-95 transition-all"
                  >
                    <div className="text-brand-accent">
                      {FIELD_ICONS[type]}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-center">{type.replace('-', ' ')}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
