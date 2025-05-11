<script setup lang="ts">
import Login from './Pages/Login.vue';
import Register from './Pages/Register.vue';
import Chat from './Pages/Chat.vue';
import OnlineUsers from './components/OnlineUsers.vue';
import { ref, onMounted } from 'vue';
import { logoutUser } from './composables/auth';
import { auth, db } from '@/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { BadgeCheck, TriangleAlert } from 'lucide-vue-next';
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
    <div v-if="!loggedInUser && !loading" class="ml-5 mt-5">
      <Login v-if="isLoginPage"/>
      <Register v-else/>
      <p v-if="isLoginPage" @click="isLoginPage = !isLoginPage">Don't Have an account yet? <span class="underline cursor-pointer text-blue-600">Register</span>.</p>
      <p v-else @click="isLoginPage = !isLoginPage">Already have an account? <span class="underline cursor-pointer text-blue-600">Login</span>.</p>
    </div>

    <div v-if="loggedInUser" class="border border-slate-300 p-3 break-all">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 p-3 border border-slate-300">
        <div class="col-span-1 lg:col-span-1 break-all">
          <div class="flex justify-between items-center mb-2 lg:mb-0"> <p >Hello, <strong>{{ loggedInUser.displayName }}!</strong> </p>
            <button
            @click="handleLogout"
              class="border border-slate-300 rounded-md py-1 px-2 cursor-pointer hover:bg-red-400 lg:hidden"
            >
              Logout
            </button>
          </div>
          <p class="text-[13px]">
            <!-- <strong class="text-slate-800">UID:</strong>  -->
            <span class="text-slate-600">{{ loggedInUser.uid }}</span>
          </p>
          <div class="flex items-center">
            <p class="text-[13px] lg:mb-0 mr-1"><strong class="text-slate-700">Email Verified:</strong></p>
            <div v-if="loggedInUser.emailVerified === true">
                <BadgeCheck class="w-5 h-5 mr-1" fill="#3897f1" color="#ffffff" :stroke-width="2" />
              </div>
              <div v-else>
                <div class="flex">
                  <TriangleAlert class="w-5 h-5 mr-1"/>
                  <a href="#" class="text-[15px] text-blue-500 hover:underline">verify</a>
                </div>
              </div>
          </div>

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