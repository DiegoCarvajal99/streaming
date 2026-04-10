import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAc12-NNlk3IaCBlRoOuLOGMJJQGIkmGpQ",
  authDomain: "streaming-admin-45c51.firebaseapp.com",
  projectId: "streaming-admin-45c51",
  storageBucket: "streaming-admin-45c51.firebasestorage.app",
  messagingSenderId: "341650375058",
  appId: "1:341650375058:web:b74407a3ce13f29e42c14b",
  measurementId: "G-F0CMQT414Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export { firebaseConfig };
