import React from 'react';
import { Question } from '@/services/challengeService';

interface Props {
  question: Question;
  index: number;
  total: number;
  selected: number | string | null;
  correctAnswer?: number | string;
  onSelect: (option: number | string) => void;
  disabled?: boolean;
}

export const QuestionCard: React.FC<Props> = ({
  question, index, total, selected, correctAnswer, onSelect, disabled,
}) => {
  const getOptionClass = (opt: number | string) => {
    if (correctAnswer !== undefined) {
      if (String(opt) === String(correctAnswer)) return 'qcard-opt qcard-opt--correct';
      if (String(opt) === String(selected) && String(opt) !== String(correctAnswer)) return 'qcard-opt qcard-opt--wrong';
      return 'qcard-opt qcard-opt--dim';
    }
    return `qcard-opt${String(selected) === String(opt) ? ' qcard-opt--selected' : ''}`;
  };

  return (
    <div className="qcard">
      <div className="qcard-header">
        <span className="qcard-num">Q{index + 1} / {total}</span>
      </div>
      <p className="qcard-text">{question.text}</p>
      <div className="qcard-options">
        {question.options.map((opt, i) => (
          <button
            key={i}
            className={getOptionClass(opt)}
            onClick={() => !disabled && onSelect(opt)}
            disabled={disabled}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};
