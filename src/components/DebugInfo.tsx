import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded text-xs max-w-xs">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div className="space-y-1">
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>Current User: {currentUser ? 'Yes' : 'No'}</p>
        <p>User Profile: {userProfile ? 'Yes' : 'No'}</p>
        {currentUser && (
          <p>User ID: {currentUser.uid}</p>
        )}
        {userProfile && (
          <p>Username: {userProfile.username}</p>
        )}
      </div>
    </div>
  );
};

export default DebugInfo; 