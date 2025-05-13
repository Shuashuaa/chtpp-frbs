<script setup lang="ts">
import Chat from './Pages/Chat.vue';
import OnlineUsers from './components/OnlineUsers.vue';
import { ref, onMounted } from 'vue';
import { logoutUser, sendVerificationEmail } from './composables/auth';
import { auth, db } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { BadgeCheck, TriangleAlert } from 'lucide-vue-next';
import AuthVue from './Pages/Auth.vue';

const loggedInUser = ref(auth.currentUser);
const loading = ref(true); // Add a loading state
// const isLoginPage = ref(true);
const isSendingVerification = ref(false);

// Function to update user status to offline on explicit logout
const handleLogout = async () => {
  const user = auth.currentUser;
  if (user) {
    const userRef = doc(db, 'online_users', user.uid);
    try {
      await updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error setting user offline status on logout: ", e);
    }
  }
  // Call your existing logout function
  logoutUser();
};

// Function to handle sending the verification email
const handleSendVerificationEmail = async () => {
  if (loggedInUser.value && !isSendingVerification.value) {
    isSendingVerification.value = true; // Disable button
    try {
      await sendVerificationEmail(loggedInUser.value);
      alert('Verification email sent! Please check your inbox.'); // Simple feedback
      // You might want to add more sophisticated UI feedback here
    } catch (error) {
      console.error('Failed to send verification email:', error);
      alert('Failed to send verification email. Please try again.'); // Simple error feedback
    } finally {
      isSendingVerification.value = false; // Re-enable button
    }
  }
};


onMounted(() => {
  auth.onAuthStateChanged(async (user: any) => { // Make the callback async
    loggedInUser.value = user;
    loading.value = false; // Set loading to false once the auth state is determined

    // When user logs in, set their status to online
    if (user) {
      const userRef = doc(db, 'online_users', user.uid);
      try {
        await updateDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      } catch (e) {
        console.error("Error setting user online status on login: ", e);
         // If the document doesn't exist, create it
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          isOnline: true,
          lastSeen: serverTimestamp(),
        });
      }
    }
  });
});
</script>

<template>
  <div>
    <div v-if="!loggedInUser && !loading"> <!--class="ml-5 mt-5"-->
      <AuthVue/>
    </div>

    <div v-if="loggedInUser">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-slate-50">
        
        <div class="col-span-1 mx-5 my-5">
          <p >Hello, <strong>{{ loggedInUser.displayName }}!</strong> </p>
          <button
          @click="handleLogout"
            class="border border-slate-300 rounded-md py-1 px-2 cursor-pointer hover:bg-red-400 lg:hidden"
          >
            Logout
          </button>
          <span class="text-slate-600">{{ loggedInUser.uid }}</span>
          <div class="flex items-center">
            <p class="text-[13px] lg:mb-0 mr-1"><strong class="text-slate-700">Email Verified:</strong></p>
            <div v-if="loggedInUser.emailVerified === true">
              <BadgeCheck class="w-5 h-5 mr-1" fill="#3897f1" color="#ffffff" :stroke-width="2" />
            </div>
            <div v-else>
              <div class="flex">
                <TriangleAlert class="w-5 h-5 mr-1 text-yellow-500"/> <button
                  @click.prevent="handleSendVerificationEmail"
                  :disabled="isSendingVerification"
                  class="text-[15px] text-blue-500 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {{ isSendingVerification ? 'Sending...' : 'verify' }}
                </button>
              </div>
            </div>
          </div>
          <OnlineUsers class="mt-5" />
        </div>

        <div class="col-span-1 lg:col-span-2">
          <Chat :loggedInUser="loggedInUser" />
        </div>

        <div class="col-span-1 hidden lg:block mr-5 mt-5">
          <div class="flex justify-end">
            <button
            @click="handleLogout"
              class="border border-slate-300 rounded-md py-1 px-2 cursor-pointer hover:bg-red-400 bg-white"
            >
              Logout
            </button>
          </div>
        </div>

      </div>

    </div>
    <div v-else-if="loading" class="w-full h-[100dvh] flex flex-col justify-center items-center">
      <p>Loading user session...</p>
      <img src="/cattoo.gif" alt="" width="200">
    </div>
  </div>
</template>