<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { db } from '@/firebase'; // Assuming your firebase config is exported as db
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '@/firebase'; // Assuming auth is also exported

const onlineUsers = ref<any[]>([]);
const offlineUsers = ref<any[]>([]);
const unsubscribe = ref<() => void | null>();
const unsubscribeOffline = ref<() => void | null>();

// Function to update user status to online
const setUserOnline = async () => {
  const user = auth.currentUser;

  if (user) {
    const userRef = doc(db, 'online_users', user.uid);
    try {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        isOnline: true,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        isOnline: true,
        lastSeen: serverTimestamp(),
      });
    }
  }
};

// Function to update user status to offline
const setUserOffline = async () => {
  const user = auth.currentUser;
  if (user) {
    const userRef = doc(db, 'online_users', user.uid);
    try {
      await updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {
      console.error("Error setting user offline status: ", e);
    }
  }
};

onMounted(() => {
  // Set user status to online when component is mounted (user is logged in and viewing chat)
  setUserOnline();

  // Listen for changes in the online_users collection where isOnline is true
  const q = query(collection(db, 'online_users'), where('isOnline', '==', true));
  unsubscribe.value = onSnapshot(q, (snapshot) => {
    const users: any[] = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    onlineUsers.value = users;
  }, (error) => {
    console.error("Error fetching online users: ", error);
  });

  const q1 = query(collection(db, 'online_users'), where('isOnline', '==', false));
  unsubscribeOffline.value = onSnapshot(q1, (snapshot) => {
    const users: any[] = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    offlineUsers.value = users;
  }, (error) => {
    console.error("Error fetching offline users: ", error);
  });

  // Add event listeners to set user offline when they close the tab/browser
  window.addEventListener('beforeunload', setUserOffline);
});

onUnmounted(() => {
  // Set user status to offline when component is unmounted (user logs out or navigates away)
  setUserOffline();

  // Unsubscribe from the snapshot listener
  if (unsubscribe.value && unsubscribeOffline.value) {
    unsubscribe.value();
    unsubscribeOffline.value();
  }

  // Remove the beforeunload event listener
  window.removeEventListener('beforeunload', setUserOffline);
});
</script>

<template>
  <div class="border border-slate-300 p-3 rounded-md">
    <h3 class="text-lg font-semibold mb-2">Users</h3>
    <p class="italic text-sm text-slate-400">
      online — ({{ onlineUsers.length }})
    </p>
    <ul>
      <li v-for="user in onlineUsers" :key="user.id" class="mb-1">
        <span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
        <p class="inline-block text-sm">{{ user.displayName }}</p>
      </li>
      <!-- <li v-if="onlineUsers.length === 0">No users online.</li> -->
    </ul>

    <p class="italic text-sm text-slate-400">
      offline — ({{ offlineUsers.length }})
    </p>
    <ul>
      <li v-for="user in offlineUsers" :key="user.id" class="mb-1">
        <span class="inline-block w-2 h-2 bg-slate-400 rounded-full mr-2"></span>
        <p class="inline-block text-sm">{{ user.displayName }}</p>
      </li>
      <!-- <li v-if="onlineUsers.length === 0">No users online.</li> -->
    </ul>
  </div>
</template>
