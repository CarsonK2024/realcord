import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import LoadingSpinner from '../components/LoadingSpinner';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  signup: (email: string, password: string, username: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  createdAt: Date;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string, username: string) => {
    try {
      console.log('Attempting to create user with email:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User created successfully:', user.uid);
      
      // Create user profile in Firestore
      const userProfileData: UserProfile = {
        uid: user.uid,
        username,
        email: user.email!,
        createdAt: new Date()
      };
      
      console.log('Saving user profile to Firestore:', userProfileData);
      await setDoc(doc(db, 'users', user.uid), userProfileData);
      setUserProfile(userProfileData);
      console.log('User profile saved successfully');
    } catch (error: any) {
      console.error('Error during signup:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting to login with email:', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful');
    } catch (error: any) {
      console.error('Error during login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('Attempting to logout');
      await signOut(auth);
      setUserProfile(null);
      console.log('Logout successful');
    } catch (error: any) {
      console.error('Error during logout:', error);
      throw error;
    }
  };

  // Create a default profile for existing users who don't have one
  const createDefaultProfile = async (user: User) => {
    try {
      console.log('Creating default profile for existing user:', user.uid);
      const userProfileData: UserProfile = {
        uid: user.uid,
        username: user.email?.split('@')[0] || 'User' + user.uid.slice(-4),
        email: user.email!,
        createdAt: new Date()
      };
      
      await setDoc(doc(db, 'users', user.uid), userProfileData);
      setUserProfile(userProfileData);
      console.log('Default profile created successfully');
    } catch (error) {
      console.error('Error creating default profile:', error);
    }
  };

  useEffect(() => {
    console.log('Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      setCurrentUser(user);
      
      if (user) {
        // Fetch user profile from Firestore
        try {
          console.log('Fetching user profile for:', user.uid);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data() as UserProfile;
            console.log('User profile found:', profileData);
            setUserProfile(profileData);
          } else {
            console.log('No user profile found in Firestore, creating default profile');
            await createDefaultProfile(user);
          }
        } catch (error: any) {
          console.error('Error fetching user profile:', error);
          // If there's a permissions error, try to create a default profile
          if (error.code === 'permission-denied') {
            console.log('Permission denied, creating default profile');
            await createDefaultProfile(user);
          }
        }
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    signup,
    login,
    logout,
    loading
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 