<script setup lang="ts">
import ChtppVue from './components/Chtpp.vue';
import Login from './components/Login.vue';
import Register from './components/Register.vue';
import Chat from './components/Chat.vue';
import { ref, onMounted } from 'vue';
import { auth } from '@/firebase';
import { logoutUser } from './composables/auth';

const loggedInUser = ref(auth.currentUser);
const loading = ref(true); // Add a loading state

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
    <h1>App</h1>
    <div v-if="!loggedInUser && !loading">
      <Login />
      <Register />
    </div>

    <div v-if="loggedInUser" class="border border-slate-300 p-3 break-all">
      <h2>User Details</h2>
      <p><strong>UID:</strong> {{ loggedInUser.uid }}</p>
      <!-- <p>{{ loggedInUser }}</p> -->
      <p><strong>Email Verified:</strong> {{ loggedInUser.emailVerified }}</p>
      <Chat :loggedInUser="loggedInUser" />
      <button @click="logoutUser" class="border border-slate-300 rounded-md py-1 px-2 cursor-pointer hover:bg-slate-200">Logout</button>
    </div>
    <div v-else-if="loading">
      <p>Loading user session...</p>
    </div>
  </div>
</template>