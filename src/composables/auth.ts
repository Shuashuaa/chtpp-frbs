// src/composables/auth.ts
import { auth } from '@/firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendEmailVerification, 
    updateProfile,
    type UserCredential, 
    type User 
} from 'firebase/auth';

// Function to send email verification
export async function sendVerificationEmail(user: User): Promise<void> {
  try {
      await sendEmailVerification(user);
      console.log('Verification email sent successfully.');
  } catch (error: any) {
      console.error('Error sending verification email:', error.message);
      throw error; // Re-throw the error for handling in the calling component
  }
}

export async function registerUser(email: string, password: string, displayName: string): Promise<UserCredential | null> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(userCredential.user, {
      displayName: displayName,
    })

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