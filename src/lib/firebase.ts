import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB8VkoVFKQwDk7NEQjWP9wNbD402u9hYvA",
  authDomain: "ticketing-app-d4fb3.firebaseapp.com",
  projectId: "ticketing-app-d4fb3",
  storageBucket: "ticketing-app-d4fb3.firebasestorage.app",
  messagingSenderId: "1010769962313",
  appId: "1:1010769962313:web:7033a4ee41ae2ee8fa6698"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
