<template>
    <div>
        <h2>Register</h2>
        <input type="text" v-model="displayName" placeholder="Username">
        <input type="email" v-model="email" placeholder="Email">
        <input type="password" v-model="password" placeholder="Password">
        <button @click="handleRegister">Register</button>
        <p v-if="error">{{ error }}</p>
    </div>
</template>
  
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