import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen bg-discord-dark flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-discord-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-white text-xl font-semibold">Loading Discord Clone...</h2>
        <p className="text-gray-400 mt-2">Please wait while we set everything up</p>
      </div>
    </div>
  );
};

export default LoadingSpinner; 