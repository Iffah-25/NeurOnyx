import React, { useState } from 'react';
import { ShieldAlert, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';

interface Props {
  error?: string;
  onRetry?: () => void;
}

const DEFAULT_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /forms/{formId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.createdBy == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.createdBy == request.auth.uid;
    }
    match /responses/{responseId} {
      allow create: if request.resource.data.formId is string;
      allow read: if true;
      allow update, delete: if request.auth != null;
    }
  }
}`;

export default function FirebasePermissionError({ error, onRetry }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(DEFAULT_RULES);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPermissionError = 
    error?.toLowerCase().includes('permission') || 
    error?.toLowerCase().includes('insufficient') ||
    error?.toLowerCase().includes('denied');

  return (
    <div className="p-6 md:p-8 rounded-3xl border border-red-500/20 bg-red-500/5 backdrop-blur-xl space-y-6 my-6 text-left">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-red-500/10 rounded-2xl text-red-400 shrink-0">
          <ShieldAlert size={28} />
        </div>
        <div className="space-y-1 flex-1">
          <h3 className="text-xl font-bold text-red-400">
            {isPermissionError ? 'Firestore Security Rules Permission Error' : 'Database Connection Issue'}
          </h3>
          <p className="text-sm text-white/60 leading-relaxed">
            {error || 'Unable to access Firebase Firestore documents.'}
          </p>
        </div>
      </div>

      {isPermissionError && (
        <div className="space-y-4 pt-2 border-t border-red-500/10">
          <p className="text-sm text-white/70">
            This error usually happens when your Firebase Firestore security rules have expired or are set to deny reads and writes. To resolve this:
          </p>

          <ol className="list-decimal list-inside text-sm text-white/70 space-y-2 leading-relaxed">
            <li>
              Open your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline inline-flex items-center gap-1 font-medium">Firebase Console <ExternalLink size={12} /></a> and select your project.
            </li>
            <li>Navigate to <strong>Firestore Database</strong> &rarr; <strong>Rules</strong> tab.</li>
            <li>Replace the existing rules with the recommended rules below and click <strong>Publish</strong>.</li>
          </ol>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-white/40 font-mono">
              <span>Recommended firestore.rules</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copied ? 'Copied Rules' : 'Copy Rules'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48 leading-relaxed">
              {DEFAULT_RULES}
            </pre>
          </div>
        </div>
      )}

      {onRetry && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-xl transition-all text-sm"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
