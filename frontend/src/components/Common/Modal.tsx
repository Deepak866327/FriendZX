import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { overlayVariants, modalVariants } from '@/utils/animations';

const sizeClass = {
  small:  'max-w-sm',
  medium: 'max-w-md',
  large:  'max-w-2xl',
} as const;

interface ModalProps {
  isOpen: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: keyof typeof sizeClass;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  children,
  onClose,
  size = 'medium',
  showCloseButton = true,
}) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(15,10,40,0.45)', backdropFilter: 'blur(6px)' }}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={`glass-strong w-full ${sizeClass[size]} rounded-3xl overflow-hidden`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={e => e.stopPropagation()}
          >
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/30">
                {title && (
                  <h2 className="text-base font-semibold text-slate-800 tracking-tight">{title}</h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="btn-icon ml-auto -mr-1 text-slate-500 hover:text-slate-700"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal isOpen={isOpen} title={title} onClose={onCancel} size="small" showCloseButton={false}>
    <p className="text-sm text-slate-600 leading-relaxed mb-6">{message}</p>
    <div className="flex gap-3">
      <button
        className="btn-secondary flex-1"
        onClick={onCancel}
        disabled={isLoading}
      >
        {cancelText}
      </button>
      <button
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all min-h-[44px] ${
          isDangerous
            ? 'bg-gradient-to-r from-rose-500 to-red-500 shadow-[0_4px_14px_rgba(239,68,68,0.30)]'
            : 'btn-primary'
        }`}
        onClick={onConfirm}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        ) : confirmText}
      </button>
    </div>
  </Modal>
);
