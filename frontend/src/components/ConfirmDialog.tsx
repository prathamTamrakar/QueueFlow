import React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-md bg-[#11141c] border border-slate-800 p-5 shadow-2xl">
        <div className="flex items-start space-x-3">
          <div
            className={`p-2 rounded border shrink-0 ${
              isDestructive
                ? 'bg-rose-950/40 text-rose-400 border-rose-800/60'
                : 'bg-brand-950/40 text-brand-400 border-brand-800/60'
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end space-x-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded-md text-white text-xs font-medium border transition ${
              isDestructive
                ? 'bg-rose-700 hover:bg-rose-600 border-rose-600/60'
                : 'bg-brand-600 hover:bg-brand-500 border-brand-500/50'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

