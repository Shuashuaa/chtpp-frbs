// src/composables/auth.ts
import { auth } from '@/firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendEmailVerification, 
    type UserCredential, 
    type User 
} from 'firebase/auth';

export async function registerUser(email: string, password: string): Promise<UserCredential | null> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Registration successful:', userCredential.user);
    return userCredential;
  } catch (error: any) {
    console.error('Registration failed:', error.message);
    throw error;
  }
}

export async function loginUser(email: string, password: string): Promise<UserCredential | null> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Login successful:', userCredential.user);
    return userCredential;
  } catch (error: any) {
    console.error('Login failed:', error.message);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
    console.log('Logged out successfully');
  } catch (error: any) {
    console.error('Logout failed:', error.message);
    throw error;
  }
}