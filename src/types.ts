export type FieldType = 
  | 'text' 
  | 'email' 
  | 'phone' 
  | 'dropdown' 
  | 'single-choice'
  | 'multiple-choice' 
  | 'checkbox' 
  | 'paragraph' 
  | 'file'
  | 'image'
  | 'section';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For dropdown, multiple-choice, checkbox
  imageUrl?: string; // For static image display (e.g. QR codes)
}

export interface FormStructure {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  createdAt: number;
  createdBy: string;
  slug: string; // For unique shareable URL
  headerImage?: string;
  successMessage?: string;
  isOpen: boolean;
  limitOneResponse?: boolean;
  theme?: {
    fontFamily: string;
    accentColor: string;
    backgroundColor: string;
  };
}

export interface FormResponse {
  id: string;
  formId: string;
  data: Record<string, any>;
  submittedAt: number;
  userEmail?: string;
}
