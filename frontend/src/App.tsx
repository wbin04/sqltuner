import { useEffect, useState } from 'react';
import axios from './lib/axios';
import type { HealthResponse } from './types/api';

function App() {
  const [healthStatus, setHealthStatus] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<HealthResponse>('/health');
      setHealthStatus(response.data);
    } catch (err) {
      setError('Failed to connect to backend server');
      console.error('Health check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            SQLTuner
          </h1>
          <p className="text-gray-400 text-lg">
            AI-powered SQL optimization using Local LLM
          </p>
        </div>

        {/* Status Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-lg shadow-2xl p-8 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-6 text-center">
              System Status
            </h2>

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <svg
                    className="w-6 h-6 text-red-500 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-red-300">{error}</span>
                </div>
              </div>
            ) : healthStatus ? (
              <div className="space-y-4">
                {/* Backend Status */}
                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300">Backend Status:</span>
                  <span className="flex items-center">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    <span className="text-green-400 font-semibold">
                      {healthStatus.status.toUpperCase()}
                    </span>
                  </span>
                </div>

                {/* Project Name */}
                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300">Project:</span>
                  <span className="text-blue-400 font-semibold">
                    {healthStatus.project_name}
                  </span>
                </div>

                {/* Model Name */}
                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300">LLM Model:</span>
                  <span className="text-purple-400 font-semibold">
                    {healthStatus.model_name}
                  </span>
                </div>

                {/* Model Availability */}
                <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300">Model Available:</span>
                  <span className="flex items-center">
                    <span
                      className={`w-3 h-3 rounded-full mr-2 ${
                        healthStatus.model_available
                          ? 'bg-green-500 animate-pulse'
                          : 'bg-red-500'
                      }`}
                    ></span>
                    <span
                      className={`font-semibold ${
                        healthStatus.model_available
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {healthStatus.model_available ? 'YES' : 'NO'}
                    </span>
                  </span>
                </div>
              </div>
            ) : null}

            {/* Refresh Button */}
            <button
              onClick={checkHealth}
              disabled={loading}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-105"
            >
              {loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-blue-400 text-sm font-semibold mb-2">
                API Docs
              </div>
              <div className="text-gray-400 text-xs">
                Visit{' '}
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  /docs
                </a>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-purple-400 text-sm font-semibold mb-2">
                Health Check
              </div>
              <div className="text-gray-400 text-xs">
                Endpoint:{' '}
                <span className="text-purple-400 font-mono">/health</span>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-green-400 text-sm font-semibold mb-2">
                Frontend
              </div>
              <div className="text-gray-400 text-xs">
                React + TypeScript + Vite
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
