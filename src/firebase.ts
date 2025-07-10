import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDrR6TwEAUiP8yDuGDwBNoKq-qdOec-ogQ",
  authDomain: "discord-clone-a5b1c.firebaseapp.com",
  projectId: "discord-clone-a5b1c",
  storageBucket: "discord-clone-a5b1c.firebasestorage.app",
  messagingSenderId: "916747214664",
  appId: "1:916747214664:web:6d9fa1baa2237af4415d7d",
  measurementId: "G-G55FHS03HG"
};

console.log('Initializing Firebase with config:', firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log('Firebase app initialized');

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
console.log('Firebase Auth initialized');

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
console.log('Firestore initialized');

export default app; 