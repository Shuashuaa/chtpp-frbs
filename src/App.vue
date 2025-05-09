<script setup lang="ts">
import ChtppVue from './components/ChatappRemake.vue';
import Login from './components/Login.vue';
import Register from './components/Register.vue';
import Chat from './components/ChatappRemake.vue';
import OnlineUsers from './components/OnlineUsers.vue'; // Import the new component
import { ref, onMounted } from 'vue';
import { logoutUser } from './composables/auth';
import { auth, db } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'; // Import firestore functions

const loggedInUser = ref(auth.currentUser);
const loading = ref(true); // Add a loading state
const isLoginPage = ref(true);

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
        // import { setDoc } from 'firebase/firestore';
        // await setDoc(userRef, {
        //   uid: user.uid,
        //   displayName: user.displayName || 'Anonymous',
        //   isOnline: true,
        //   lastSeen: serverTimestamp(),
        // });
      }
    }
  });
});
</script>

<template>
  <div>
    <!-- <ChtppVue sample="ehe"/> -->
    <!-- <h1>App</h1> -->
    <div v-if="!loggedInUser && !loading">
      <Login v-if="isLoginPage"/>
      <Register v-else/>
      <p v-if="isLoginPage" @click="isLoginPage = !isLoginPage">Don't Have an account yet? <span class="underline cursor-pointer text-blue-600">Register</span>.</p>
      <p v-else @click="isLoginPage = !isLoginPage">Already have an account? <span class="underline cursor-pointer text-blue-600">Login</span>.</p>
    </div>
    <!-- lg:flex lg:justify-between block -->
    <div v-if="loggedInUser" class="border border-slate-300 p-3 break-all">

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 p-3 border border-slate-300">

        <div class="col-span-1 lg:col-span-1 break-all">
          <div class="flex justify-between items-center mb-2 lg:mb-0"> <p><strong>username:</strong> {{ loggedInUser.displayName }}</p>
            <button
            @click="handleLogout"
              class="border border-slate-300 rounded-md py-1 px-2 cursor-pointer hover:bg-red-400 lg:hidden"
            >
              Logout
            </button>
          </div>
          <p><strong>UID:</strong> {{ loggedInUser.uid }}</p>
          <p class="mb-5 lg:mb-0"><strong>Email Verified:</strong> {{ loggedInUser.emailVerified }}</p>

          <div class="mt-5">
             <OnlineUsers />
          </div>
        </div>

        <div class="col-span-1 lg:col-start-2 lg:col-span-2">
          <Chat :loggedInUser="loggedInUser" />
        </div>

        <div class="col-span-1 lg:col-span-1 hidden lg:flex lg:justify-end">
          <div>
            <button
            @click="handleLogout"
              class="border border-slate-300 rounded-md py-1 px-2 cursor-pointer hover:bg-red-400"
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