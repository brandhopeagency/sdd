import { CHAT_URL } from '../config';

export default function RouteRecovery() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-4xl font-bold text-gray-400 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Page Not Found</h2>
        <p className="text-gray-600 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/workbench"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Workbench
          </a>
          <a
            href={`${CHAT_URL}/chat`}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Go to Chat
          </a>
        </div>
      </div>
    </div>
  );
}
