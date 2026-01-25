// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

interface Session {
  id: string;
  deviceInfo: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export const SessionManager: React.FC = () => {
  const { getUserSessions, logoutAll } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getUserSessions();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleLogoutAll = async () => {
    if (window.confirm('Are you sure you want to logout from all devices?')) {
      try {
        await logoutAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to logout from all devices');
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPpp');
    } catch {
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
        <button
          onClick={loadSessions}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">Active Sessions</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Manage your active sessions across different devices
          </p>
        </div>
        <button
          onClick={handleLogoutAll}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Logout All Devices
        </button>
      </div>
      <div className="border-t border-gray-200">
        <ul className="divide-y divide-gray-200">
          {sessions.map((session) => (
            <li key={session.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {session.deviceInfo}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500">
                    <div>
                      <p>Created: {formatDate(session.createdAt)}</p>
                      <p>Last Used: {formatDate(session.lastUsedAt)}</p>
                    </div>
                    <div>
                      <p>Expires: {formatDate(session.expiresAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
              No active sessions found
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}; 