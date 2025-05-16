<script setup lang="ts">
import { ref } from 'vue';

import Login from './Login.vue';
import Register from './Register.vue';

const isLoginPage = ref(true);

</script>

<template>
    <div class="grid grid-cols-1 lg:grid-cols-2 h-screen">
  
      <div class="hidden lg:block">
        <img draggable="false" src="/nexus.gif" alt="Nexus GIF" class="object-cover w-full h-full">
      </div>
  
      <div class="flex flex-col items-center justify-center p-4">
        <div class="w-full flex items-center flex-col gap-10">
            <div class="flex justify-center items-center">
                <img draggable="false" src="/nexus.png" class="mr-2" alt="" width="40">
                <p class="text-slate-600"> — Neksəs.</p>
            </div>

            <div>
                <Login v-if="isLoginPage"/>
                <Register v-else/>
        
                <p v-if="isLoginPage" @click="isLoginPage = !isLoginPage" class="mt-4 text-center text-sm">
                    Don't Have an account yet? <span class="underline cursor-pointer text-blue-600">Register</span>.
                </p>
                <p v-else @click="isLoginPage = !isLoginPage" class="mt-4 text-center text-sm">
                    Already have an account? <span class="underline cursor-pointer text-blue-600">Login</span>.
                </p>
            </div>
            
        </div>
      </div>
  
    </div>
  </template>
  