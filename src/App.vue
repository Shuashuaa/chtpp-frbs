<script setup lang="ts">
import ChtppVue from './components/ChatappRemake.vue';
import Login from './components/Login.vue';
import Register from './components/Register.vue';
import Chat from './components/ChatappRemake.vue';
import { ref, onMounted } from 'vue';
import { auth } from '@/firebase';
import { logoutUser } from './composables/auth';

const loggedInUser = ref(auth.currentUser);
const loading = ref(true); // Add a loading state
const isLoginPage = ref(true);

onMounted(() => {
  auth.onAuthStateChanged((user: any) => {
    loggedInUser.value = user;
    loading.value = false; // Set loading to false once the auth state is determined
  });
});
</script>

<template>
  <div class="p-3">
    <!-- <ChtppVue sample="ehe"/> -->
    <!-- <h1>App</h1> -->
    <div v-if="!loggedInUser && !loading">
      <Login v-if="isLoginPage"/>
      <Register v-else/>
      <p v-if="isLoginPage" @click="isLoginPage = !isLoginPage">Don't Have an account yet? <span class="underline cursor-pointer text-blue-600">Register</span>.</p>
      <p v-else @click="isLoginPage = !isLoginPage">Already have an account? <span class="underline cursor-pointer text-blue-600">Login</span>.</p>
    </div>

    <div v-if="loggedInUser" class="border border-slate-300 p-3 break-all">
      
      <div>
        <div class="flex justify-between">
          <p><strong>username:</strong> {{ loggedInUser.displayName }}</p>
          <button @click="logoutUser" class="border border-slate-300 rounded-md py-1 px-2 cursor-pointer hover:bg-red-400">Logout</button>
        </div>
        <p><strong>UID:</strong> {{ loggedInUser.uid }}</p>
        <p class="mb-5"><strong>Email Verified:</strong> {{ loggedInUser.emailVerified }}</p>
      </div>
      
      <Chat :loggedInUser="loggedInUser" />

    </div>
    <div v-else-if="loading">
      <p>Loading user session...</p>
    </div>
  </div>
</template>