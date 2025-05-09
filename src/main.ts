import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// import { analytics  } from '@/firebase';

const app = createApp(App);
// app.provide('firebaseAnalytics', analytics);

app.mount('#app')
