<script setup lang="ts">
    import { ref } from 'vue';
    import { loginUser } from '../composables/auth';
    
    const email = ref('');
    const password = ref('');
    const error = ref('');
    
    const handleLogin = async () => {
        error.value = '';
        
        try {
            await loginUser(email.value, password.value);
            // Redirect the user or update the UI upon successful login
            console.log('Successfully logged in!');
        } catch (err: any) {
            error.value = err.message;
        }
    };
</script>

<template>
    <div>
        <h2>Login</h2>
        <input type="email" v-model="email" placeholder="Email">
        <input type="password" v-model="password" placeholder="Password">
        <button @click="handleLogin">Login</button>
        <p v-if="error" class="text-red-400">{{ error }}</p>
    </div>
</template>