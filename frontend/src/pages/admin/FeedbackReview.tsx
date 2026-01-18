import { useState } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle, Clock, Code2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

// Mock Feedback Data
const feedbackData = [
  {
    id: 1,
    date: '2026-01-17 10:23',
    userEmail: 'john@example.com',
    originalQuery: 'How can I get all orders from last month with customer details?',
    aiGeneratedSQL: 'SELECT o.*, c.name FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)',
    rating: 'down',
    userCorrection: 'SELECT o.order_id, o.total, c.name, c.email FROM orders o INNER JOIN customers c ON o.customer_id = c.id WHERE o.created_at >= CURDATE() - INTERVAL 1 MONTH ORDER BY o.created_at DESC',
    status: 'pending',
  },
  {
    id: 2,
    date: '2026-01-17 09:15',
    userEmail: 'sarah@example.com',
    originalQuery: 'Show me top 10 selling products',
    aiGeneratedSQL: 'SELECT product_id, SUM(quantity) as total_sold FROM order_items GROUP BY product_id ORDER BY total_sold DESC LIMIT 10',
    rating: 'up',
    userCorrection: null,
    status: 'reviewed',
  },
  {
    id: 3,
    date: '2026-01-17 08:42',
    userEmail: 'mike@example.com',
    originalQuery: 'Find customers who never made a purchase',
    aiGeneratedSQL: 'SELECT * FROM customers WHERE id NOT IN (SELECT customer_id FROM orders)',
    rating: 'down',
    userCorrection: 'SELECT c.* FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE o.id IS NULL',
    status: 'pending',
  },
  {
    id: 4,
    date: '2026-01-17 07:30',
    userEmail: 'emma@example.com',
    originalQuery: 'Calculate average order value by month',
    aiGeneratedSQL: 'SELECT DATE_FORMAT(created_at, "%Y-%m") as month, AVG(total) as avg_value FROM orders GROUP BY month',
    rating: 'up',
    userCorrection: null,
    status: 'reviewed',
  },
  {
    id: 5,
    date: '2026-01-16 16:20',
    userEmail: 'alex@example.com',
    originalQuery: 'Get products with low stock (less than 10 units)',
    aiGeneratedSQL: 'SELECT * FROM products WHERE stock_quantity < 10',
    rating: 'up',
    userCorrection: null,
    status: 'pending',
  },
];

export function FeedbackReview() {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  const handleApprove = (id: number) => {
    console.log('Approved for fine-tuning:', id);
    // Logic to mark as reviewed and add to training dataset
  };

  const handleBulkApprove = () => {
    console.log('Bulk approved:', selectedRows);
    setSelectedRows([]);
  };

  const toggleRowSelection = (id: number) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
            AI Training & Feedback Review
          </h1>
          <p className="text-text-muted-DEFAULT dark:text-text-muted-dark mt-1">
            Review user feedback to improve AI model accuracy (RLHF)
          </p>
        </div>
        {selectedRows.length > 0 && (
          <button
            onClick={handleBulkApprove}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Approve {selectedRows.length} for Training
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
                {feedbackData.filter(f => f.status === 'pending').length}
              </p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Pending Reviews</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
                {feedbackData.filter(f => f.userCorrection).length}
              </p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">With Corrections</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-lg border border-border-DEFAULT dark:border-border-dark p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main-DEFAULT dark:text-text-main-dark">
                {feedbackData.filter(f => f.status === 'reviewed').length}
              </p>
              <p className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">Reviewed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-DEFAULT dark:bg-surface-dark rounded-xl border border-border-DEFAULT dark:border-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-highlight-DEFAULT dark:bg-surface-highlight-dark border-b border-border-DEFAULT dark:border-border-dark">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(feedbackData.map(f => f.id));
                      } else {
                        setSelectedRows([]);
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Date/Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Original Query
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  AI Generated SQL
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  User Correction
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-main-DEFAULT dark:text-text-main-dark uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-DEFAULT dark:divide-border-dark">
              {feedbackData.map((feedback) => (
                <tr 
                  key={feedback.id}
                  className={cn(
                    'hover:bg-surface-highlight-DEFAULT dark:hover:bg-surface-highlight-dark transition-colors',
                    selectedRows.includes(feedback.id) && 'bg-blue-50 dark:bg-blue-900/10'
                  )}
                >
                  <td className="px-4 py-4">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded"
                      checked={selectedRows.includes(feedback.id)}
                      onChange={() => toggleRowSelection(feedback.id)}
                    />
                  </td>
                  <td className="px-4 py-4 text-sm text-text-main-DEFAULT dark:text-text-main-dark whitespace-nowrap">
                    {feedback.date}
                  </td>
                  <td className="px-4 py-4 text-sm text-text-main-DEFAULT dark:text-text-main-dark">
                    {feedback.userEmail}
                  </td>
                  <td className="px-4 py-4 text-sm text-text-muted-DEFAULT dark:text-text-muted-dark max-w-xs truncate">
                    {feedback.originalQuery}
                  </td>
                  <td className="px-4 py-4">
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-text-main-DEFAULT dark:text-text-main-dark block max-w-sm truncate">
                      {feedback.aiGeneratedSQL}
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    {feedback.rating === 'up' ? (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-sm font-medium">Up</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <ThumbsDown className="w-4 h-4" />
                        <span className="text-sm font-medium">Down</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {feedback.userCorrection ? (
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        <code className="text-xs bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded text-orange-900 dark:text-orange-300 block max-w-xs truncate">
                          {feedback.userCorrection}
                        </code>
                      </div>
                    ) : (
                      <span className="text-sm text-text-muted-DEFAULT dark:text-text-muted-dark">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {feedback.status === 'reviewed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        <CheckCircle className="w-3 h-3" />
                        Reviewed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {feedback.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(feedback.id)}
                        className="px-3 py-1.5 bg-primary dark:bg-primary-dark hover:bg-primary-hover dark:hover:bg-primary-dark-hover text-white rounded-lg text-xs transition-colors"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
