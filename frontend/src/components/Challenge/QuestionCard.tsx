import React from 'react';
import { Check, X } from 'lucide-react';
import { Question } from '@/services/challengeService';

interface Props {
  question:      Question;
  index:         number;
  total:         number;
  selected:      number | string | null;
  correctAnswer?: number | string;
  onSelect:      (option: number | string) => void;
  disabled?:     boolean;
}

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const optionVariant = (
  opt: number | string,
  selected: number | string | null,
  correctAnswer?: number | string,
): 'default' | 'selected' | 'correct' | 'wrong' | 'dim' => {
  if (correctAnswer !== undefined) {
    if (String(opt) === String(correctAnswer)) return 'correct';
    if (String(opt) === String(selected) && String(opt) !== String(correctAnswer)) return 'wrong';
    return 'dim';
  }
  return String(selected) === String(opt) ? 'selected' : 'default';
};

const OPTION_STYLES: Record<string, string> = {
  default:  'glass text-slate-700 hover:bg-white/80 active:scale-[0.98]',
  selected: 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200/60',
  correct:  'bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-md shadow-emerald-200/60',
  wrong:    'bg-gradient-to-r from-rose-400 to-red-500 text-white shadow-md shadow-rose-200/60',
  dim:      'glass text-slate-400 opacity-50 cursor-not-allowed',
};

const LABEL_STYLES: Record<string, string> = {
  default:  'bg-white/60 text-slate-500',
  selected: 'bg-white/25 text-white',
  correct:  'bg-white/25 text-white',
  wrong:    'bg-white/25 text-white',
  dim:      'bg-white/30 text-slate-400',
};

export const QuestionCard: React.FC<Props> = ({
  question, index, total, selected, correctAnswer, onSelect, disabled,
}) => (
  <div className="flex flex-col gap-4">
    {/* Question number chip */}
    <div className="flex items-center gap-2">
      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold tracking-wide">
        Q{index + 1} / {total}
      </span>
    </div>

    {/* Question text */}
    <p className="text-base font-semibold text-slate-800 leading-snug">{question.text}</p>

    {/* Options */}
    <div className="flex flex-col gap-2">
      {question.options.map((opt, i) => {
        const variant = optionVariant(opt, selected, correctAnswer);
        const isCorrect = variant === 'correct';
        const isWrong   = variant === 'wrong';
        return (
          <button
            key={i}
            onClick={() => !disabled && onSelect(opt)}
            disabled={disabled || correctAnswer !== undefined}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-left transition-all ${OPTION_STYLES[variant]}`}
          >
            {/* Letter chip */}
            <span className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${LABEL_STYLES[variant]}`}>
              {isCorrect ? <Check size={12} /> : isWrong ? <X size={12} /> : LABELS[i]}
            </span>
            <span className="flex-1">{opt}</span>
          </button>
        );
      })}
    </div>
  </div>
);
