<script setup lang="ts">
  import { ref } from 'vue';
  import { registerUser } from '../composables/auth';
  
  const email = ref('');
  const password = ref('');
  const displayName = ref('');
  const error = ref('');
  
  const handleRegister = async () => {
      error.value = '';
      try {
      await registerUser(email.value, password.value, displayName.value);
      // Optionally log the user in immediately after registration
      console.log('Successfully registered!');
      } catch (err: any) {
      error.value = err.message;
      }
  };
</script>

<template>
  <div class="flex flex-col gap-2 md:w-md">
      <h2>Register</h2>
      <input class="border border-slate-300 py-1 px-2" @keydown.enter="handleRegister" type="text" v-model="displayName" placeholder="Username">
      <input class="border border-slate-300 py-1 px-2" @keydown.enter="handleRegister" type="email" v-model="email" placeholder="Email">
      <input class="border border-slate-300 py-1 px-2" @keydown.enter="handleRegister" type="password" v-model="password" placeholder="Password">
      <button class="border border-slate-300 py-1 px-2 rounded-lg hover:cursor-pointer hover:bg-slate-100" 
      @click="handleRegister"
      >Register</button>
      <p v-if="error" class="text-red-400">{{ error }}</p>
  </div>
</template>