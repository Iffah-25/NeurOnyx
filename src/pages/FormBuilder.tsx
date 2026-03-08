import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { FormField, FormStructure, FieldType } from '../types';
import { sanitizeForFirestore } from '../lib/utils';
import { motion, Reorder } from 'motion/react';
import { 
  Plus, Trash2, GripVertical, Settings2, Save, X, 
  Type, Mail, Phone, ChevronDown, List, CheckSquare, AlignLeft, Upload, 
  ChevronLeft, Layout, Image as ImageIcon, Camera
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const FIELD_ICONS: Record<FieldType, any> = {
  text: <Type size={18} />,
  email: <Mail size={18} />,
  phone: <Phone size={18} />,
  dropdown: <ChevronDown size={18} />,
  'multiple-choice': <List size={18} />,
  checkbox: <CheckSquare size={18} />,
  paragraph: <AlignLeft size={18} />,
  file: <Upload size={18} />,
  image: <ImageIcon size={18} />,
};

export default function FormBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [headerImage, setHeaderImage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [limitOneResponse, setLimitOneResponse] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

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
        const docRef = doc(db, 'forms', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as FormStructure;
          setTitle(data.title);
          setDescription(data.description);
          setFields(data.fields);
          setHeaderImage(data.headerImage || '');
          setSuccessMessage(data.successMessage || '');
          setIsOpen(data.isOpen !== undefined ? data.isOpen : true);
          setLimitOneResponse(data.limitOneResponse || false);
        }
        setLoading(false);
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
      options: ['dropdown', 'multiple-choice', 'checkbox'].includes(type) ? ['Option 1'] : undefined,
    };
    setFields([...fields, newField]);
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
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const formData = sanitizeForFirestore({
        title,
        description,
        fields,
        headerImage,
        successMessage,
        isOpen,
        limitOneResponse,
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
    } catch (err) {
      console.error(err);
      alert('Error saving form');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen pb-32">
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12">
          <div className="space-y-8">
            {/* Header Editor */}
            <div className="p-8 md:p-12 glass rounded-[2.5rem] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent/20" />
              <div className="space-y-6">
                <input
                  type="text"
                  placeholder="Form Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-4xl md:text-5xl font-display font-bold tracking-tight focus:outline-none placeholder:text-white/5"
                />
                <textarea
                  placeholder="Enter a description for your respondents..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-transparent text-white/40 text-lg md:text-xl focus:outline-none resize-none h-24 placeholder:text-white/5 leading-relaxed"
                />
              </div>
            </div>

            {/* Fields Editor */}
            <Reorder.Group axis="y" values={fields} onReorder={setFields} className="space-y-6">
              {fields.map((field, index) => (
                <Reorder.Item
                  key={field.id}
                  value={field}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-[2rem] group relative overflow-hidden"
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
                          <label className="flex items-center gap-3 cursor-pointer group/toggle">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 group-hover/toggle:text-white/40 transition-colors">Required</span>
                            <div 
                              onClick={() => updateField(field.id, { required: !field.required })}
                              className={`w-10 h-5 rounded-full transition-colors relative ${field.required ? 'bg-brand-accent' : 'bg-white/10'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${field.required ? 'left-6' : 'left-1'}`} />
                            </div>
                          </label>
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
                            placeholder="Field Label"
                          />
                        </div>

                        {['text', 'email', 'phone', 'paragraph'].includes(field.type) && (
                          <input
                            type="text"
                            value={field.placeholder}
                            onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-brand-accent/30 placeholder:text-white/5"
                            placeholder="Placeholder text..."
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
                <p className="text-white/10 text-sm mt-2">Select a field type from the sidebar to start building.</p>
              </div>
            )}
          </div>

          {/* Sidebar Tools */}
          <div className="space-y-8">
            {/* Form Settings */}
            <div className="glass p-8 rounded-[2.5rem] space-y-8">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-accent flex items-center gap-3">
                <div className="w-4 h-px bg-brand-accent" />
                Settings
              </h3>
              
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/20">Header Image</label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeaderImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full aspect-video glass rounded-2xl flex flex-col items-center justify-center gap-4 group-hover:bg-white/[0.05] transition-all overflow-hidden relative">
                      {headerImage ? (
                        <>
                          <img src={headerImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" referrerPolicy="no-referrer" />
                          <div className="relative z-10 flex flex-col items-center gap-2">
                            <Camera size={32} className="text-white" />
                            <span className="text-white font-bold uppercase text-[10px] tracking-widest bg-brand-bg/80 px-3 py-1 rounded-lg">Change Image</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Camera size={32} className="text-white/10" />
                          <span className="text-white/20 font-bold uppercase text-[10px] tracking-widest">Upload Header</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/20">Success Message</label>
                  <textarea
                    placeholder="Enter a message to show after submission..."
                    value={successMessage}
                    onChange={(e) => setSuccessMessage(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-5 text-sm focus:outline-none focus:border-brand-accent/30 h-40 resize-none placeholder:text-white/5 leading-relaxed"
                  />
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between p-6 glass rounded-2xl">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/20">Status</label>
                      <p className={`text-xs font-bold uppercase tracking-widest ${isOpen ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isOpen ? 'Accepting' : 'Closed'}
                      </p>
                    </div>
                    <button
                      onClick={() => setIsOpen(!isOpen)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${isOpen ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}
                    >
                      <div className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOpen ? 'translate-x-8' : 'translate-x-2'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 glass rounded-2xl">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-white/20">Limit Responses</label>
                      <p className={`text-xs font-bold uppercase tracking-widest ${limitOneResponse ? 'text-brand-accent' : 'text-white/40'}`}>
                        {limitOneResponse ? 'One per user' : 'Unlimited'}
                      </p>
                    </div>
                    <button
                      onClick={() => setLimitOneResponse(!limitOneResponse)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${limitOneResponse ? 'bg-brand-accent/20' : 'bg-white/10'}`}
                    >
                      <div className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${limitOneResponse ? 'translate-x-8' : 'translate-x-2'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass p-8 rounded-[2.5rem] space-y-8 sticky top-12">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-accent flex items-center gap-3">
                <div className="w-4 h-px bg-brand-accent" />
                Add Fields
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {(Object.keys(FIELD_ICONS) as FieldType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => addField(type)}
                    className="flex items-center justify-between w-full p-4 glass rounded-2xl hover:bg-brand-accent hover:text-brand-bg transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-white/20 group-hover:text-brand-bg transition-colors">
                        {FIELD_ICONS[type]}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{type.replace('-', ' ')}</span>
                    </div>
                    <Plus size={14} className="text-white/10 group-hover:text-brand-bg transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
