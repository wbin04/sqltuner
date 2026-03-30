import { useState } from 'react';
import { Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ClarificationQuestion {
  q: string;
  options?: string[];
}

interface Props {
  questions: ClarificationQuestion[];
  onSubmit: (answers: Array<{ q: string; answer: string }>) => void;
  isLoading?: boolean;
}

export function ClarificationBlock({ questions, onSubmit, isLoading = false }: Props) {
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const [freeText, setFreeText] = useState<Record<number, string>>({});

  const toggleOption = (qIdx: number, option: string) => {
    setSelected(prev => {
      const current = prev[qIdx] || [];
      const exists = current.includes(option);
      return {
        ...prev,
        [qIdx]: exists ? current.filter(o => o !== option) : [...current, option],
      };
    });
  };

  const handleSubmit = () => {
    const answers = questions.map((q, idx) => {
      const parts: string[] = [...(selected[idx] || [])];
      const extra = freeText[idx]?.trim();
      if (extra) parts.push(extra);
      return { q: q.q, answer: parts.join(', ') || 'No preference' };
    });
    onSubmit(answers);
  };

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      'border-purple-200 dark:border-purple-800',
      'bg-purple-50 dark:bg-purple-950/30'
    )}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-200 dark:border-purple-800 bg-purple-100 dark:bg-purple-900/40">
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
          A few questions before generating
        </span>
      </div>

      <div className="divide-y divide-purple-100 dark:divide-purple-900/50 px-4 py-3 space-y-4">
        {questions.map((q, idx) => (
          <div key={idx} className={idx > 0 ? 'pt-4' : ''}>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
              {idx + 1}. {q.q}
            </p>

            {q.options && q.options.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {q.options.map((opt, optIdx) => {
                  const isSelected = (selected[idx] || []).includes(opt);
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => toggleOption(idx, opt)}
                      disabled={isLoading}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50',
                        isSelected
                          ? 'border-purple-400 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-500'
                          : 'border-gray-300 text-gray-600 hover:border-purple-400 dark:border-gray-600 dark:text-gray-400 dark:hover:border-purple-500'
                      )}
                    >
                      {isSelected && <span className="mr-1">✓</span>}
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            <input
              type="text"
              placeholder="Add more details... (optional)"
              value={freeText[idx] || ''}
              onChange={e => setFreeText(prev => ({ ...prev, [idx]: e.target.value }))}
              disabled={isLoading}
              className={cn(
                'w-full rounded-lg border px-3 py-1.5 text-sm',
                'border-gray-300 dark:border-gray-600',
                'bg-white dark:bg-gray-800',
                'text-gray-900 dark:text-gray-100',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-purple-500',
                'disabled:opacity-50'
              )}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-purple-200 dark:border-purple-800">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Select options or type your own answers
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSubmit(questions.map(q => ({ q: q.q, answer: 'No preference' })))}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors',
              'bg-purple-600 hover:bg-purple-700 disabled:opacity-50'
            )}
          >
            {isLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <ChevronRight className="w-3.5 h-3.5" />
            }
            {isLoading ? 'Generating...' : 'Generate Schema'}
          </button>
        </div>
      </div>
    </div>
  );
}
