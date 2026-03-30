import { useState } from 'react';
import {
  X,
  Sparkles,
  ChevronLeft,
  Loader2,
  Database,
  AlertCircle,
  Check,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { workspaceService } from '../../services/workspaceService';
import type { BackendTable } from '../../types/simulation';

type Step = 'input' | 'clarify' | 'preview';

interface ClarificationQuestion {
  question: string;
  why: string;
  options: string[];
}

interface TableSummary {
  name: string;
  purpose: string;
  design_rationale: string;
  column_count: number;
  index_count: number;
}

export interface GenerateResult {
  system_name: string;
  schema_def: {
    tables: BackendTable[];
  };
  mermaid_erd: string;
  relationships: Array<{
    from_table: string;
    to_table: string;
    type: string;
    description: string;
  }>;
  design_notes: string[];
  table_count: number;
  table_summaries: TableSummary[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: GenerateResult) => void;
}

export function GenerateSchemaModal({ isOpen, onClose, onApply }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [result, setResult] = useState<GenerateResult | null>(null);

  if (!isOpen) {
    return null;
  }

  const resetState = () => {
    setStep('input');
    setDescription('');
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setIsRegenerating(false);
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const handleGenerate = async (withClarifications = false) => {
    setIsRegenerating(true);
    try {
      if (withClarifications) {
        const clarifications = questions
          .map((q, idx) => ({
            question: q.question,
            answer: (answers[idx] || []).join(', '),
          }))
          .filter((item) => item.answer.trim().length > 0);

        const generated = await workspaceService.generateSchemaFromPrompt({
          description,
          clarifications,
        });
        setResult(generated);
      }
      setStep('preview');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Schema generation failed');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCheckAndProceed = async () => {
    if (!description.trim() || description.trim().length < 10) {
      toast.error('Please describe your system in at least 10 characters');
      return;
    }

    setIsLoading(true);
    try {
      const [check, generated] = await Promise.all([
        workspaceService.checkSchemaClarification(description),
        workspaceService.generateSchemaFromPrompt({ description }),
      ]);

      setResult(generated);

      if (check.needs_clarification && check.questions.length > 0) {
        setQuestions(check.questions);
        setStep('clarify');
      } else {
        setQuestions([
          {
            question: 'Bạn có muốn thêm yêu cầu đặc biệt nào không?',
            why: 'Giúp schema phù hợp hơn với nghiệp vụ thực tế',
            options: [
              'Không, dùng schema mặc định',
              'Thêm soft delete (deleted_at)',
              'Thêm audit fields (created_by, updated_by)',
              'Tôi sẽ tự nhập thêm bên dưới',
            ],
          },
        ]);
        setStep('clarify');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to generate schema');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) {
      return;
    }
    onApply(result);
    toast.success(`Schema "${result.system_name}" applied - ${result.table_count} tables created`);
    onClose();
    resetState();
  };

  const toggleOption = (questionIdx: number, option: string) => {
    setAnswers((prev) => {
      const current = prev[questionIdx] || [];
      const exists = current.includes(option);
      return {
        ...prev,
        [questionIdx]: exists
          ? current.filter((item) => item !== option)
          : [...current, option],
      };
    });
  };

  const steps: Step[] = ['input', 'clarify', 'preview'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generate Schema from Description
            </h2>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-500">
            {steps.map((s, idx) => (
              <span key={s} className="flex items-center gap-1">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                    step === s
                      ? 'bg-purple-500 text-white'
                      : currentStepIndex > idx
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
                  }`}
                >
                  {currentStepIndex > idx ? '✓' : idx + 1}
                </span>
                {idx < 2 && <span className="text-gray-300">›</span>}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'input' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Describe your system in natural language. AI will generate a normalized schema with tables,
                columns, indexes, and relationships.
              </p>
              <textarea
                className="h-36 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                placeholder={`Examples:\n• Hệ thống quản lý thư viện với sách, thành viên, mượn trả và phạt quá hạn\n• E-commerce platform with products, orders, customers, and inventory tracking\n• Hospital management system with patients, doctors, appointments, and prescriptions`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-400">{description.length} / 2000 characters</p>
            </div>
          )}

          {step === 'clarify' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">A few quick questions to improve the schema:</p>
              {questions.map((q, idx) => (
                <div key={idx} className="space-y-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {idx + 1}. {q.question}
                  </p>
                  <p className="text-xs italic text-gray-400">{q.why}</p>

                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt, optionIdx) => (
                      <button
                        key={optionIdx}
                        type="button"
                        onClick={() => toggleOption(idx, opt)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          (answers[idx] || []).includes(opt)
                            ? 'border-purple-400 bg-purple-100 text-purple-700 ring-1 ring-purple-400 dark:bg-purple-900 dark:text-purple-300'
                            : 'border-gray-300 text-gray-600 hover:border-purple-400 dark:border-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Or type additional answer..."
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (!value) {
                        return;
                      }

                      setAnswers((prev) => ({
                        ...prev,
                        [idx]: [...(prev[idx] || []), value],
                      }));
                      e.target.value = '';
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </div>
              ))}
            </div>
          )}

          {step === 'preview' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {result.system_name} - {result.table_count} tables generated
                </p>
              </div>

              <div className="space-y-2">
                {result.table_summaries.map((table, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <Database className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {table.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {table.column_count} cols · {table.index_count} indexes
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{table.purpose}</p>
                      {table.design_rationale && (
                        <p className="mt-0.5 text-xs italic text-gray-400">{table.design_rationale}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {result.design_notes.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Design Notes</p>
                  <ul className="space-y-1">
                    {result.design_notes.map((note, idx) => (
                      <li key={idx} className="text-xs text-amber-600 dark:text-amber-400">
                        • {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-xs text-red-600 dark:text-red-400">
                  Applying this schema will replace your current sandbox schema. Existing tables and data will be
                  lost.
                </p>
              </div>
            </div>
          )}

          {isLoading && step === 'input' && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm text-gray-500">Analyzing description...</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            onClick={step === 'input' ? handleClose : () => setStep(step === 'preview' ? 'clarify' : 'input')}
            disabled={isLoading || isRegenerating}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 'input' ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            {step === 'input' && (
              <button
                type="button"
                onClick={handleCheckAndProceed}
                disabled={isLoading || description.trim().length < 10}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Schema
              </button>
            )}

            {step === 'clarify' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  disabled={isRegenerating}
                  className="px-4 py-2 text-sm text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50 dark:hover:text-gray-300"
                >
                  Skip questions
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                >
                  {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate with answers
                </button>
              </>
            )}

            {step === 'preview' && (
              <button
                type="button"
                onClick={handleApply}
                disabled={isLoading || isRegenerating}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Apply to Sandbox
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
