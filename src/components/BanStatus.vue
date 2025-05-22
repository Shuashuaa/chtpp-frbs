<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';

// Define props that the parent component (Chat.vue) will pass down
const props = defineProps<{
  isBanned: boolean;
  reason: string;
  banEndsAt: Date | null;
  // This prop will be a function passed from useSendMessage to re-check ban status
  // after the countdown ends or if the component is mounted with an expired ban.
  onBanExpired: () => Promise<void>; 
}>();

const countdownSeconds = ref(0);
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// Computed property to format the countdown time
const formatCountdown = computed(() => {
    const totalSeconds = countdownSeconds.value;
    if (totalSeconds <= 0) return '00:00';

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
});

// Function to start the countdown
const startCountdown = () => {
    // Clear any existing interval to prevent multiple countdowns
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    if (props.isBanned && props.banEndsAt) {
        // Calculate initial remaining seconds
        let remainingSeconds = Math.max(0, Math.floor((props.banEndsAt.getTime() - Date.now()) / 1000));
        countdownSeconds.value = remainingSeconds;

        if (remainingSeconds > 0) {
            countdownInterval = setInterval(() => {
                countdownSeconds.value--;
                if (countdownSeconds.value <= 0) {
                    clearInterval(countdownInterval!);
                    countdownInterval = null;
                    // Notify parent that ban might have expired so it can re-check Firestore
                    props.onBanExpired();
                }
            }, 1000);
        } else {
            // If banEndsAt is in the past immediately, trigger re-check
            props.onBanExpired();
        }
    }
};

// Function to stop the countdown
const stopCountdown = () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    countdownSeconds.value = 0;
};

// Watch for changes in ban status or end time to start/stop the countdown
watch([() => props.isBanned, () => props.banEndsAt], ([newIsBanned, newBanEndsAt]) => {
    if (newIsBanned && newBanEndsAt) {
        startCountdown();
    } else {
        stopCountdown();
    }
}, { immediate: true }); // Run immediately on component setup

// Clean up the interval when the component is unmounted
onUnmounted(() => {
    stopCountdown();
});
</script>

<template>
    <div v-if="isBanned" class="ban-message flex w-full items-center text-center py-2 px-4 rounded-md">
        <div>
            <img src="https://i.pinimg.com/originals/59/c1/07/59c107d83999d50be5ffc0e7c05e9d1a.gif" alt="">
        </div>
        <div class="w-full pl-3">
            <p class="text-red-700 font-semibold">
                You are currently banned from sending messages.
            </p>
            <p v-if="reason" class="text-red-600 text-sm">
                Reason: {{ reason }}.
            </p>
            <p v-if="banEndsAt && countdownSeconds > 0" class="text-red-600 text-sm font-bold mt-1">
                Time remaining: {{ formatCountdown }}
            </p>
            <p v-else-if="banEndsAt && countdownSeconds <= 0" class="text-red-600 text-sm">
                Your ban has expired. Please try again.
            </p>
            <p v-else-if="banEndsAt" class="text-red-600 text-sm">
                Your ban expires at: {{ banEndsAt.toLocaleString() }}.
            </p>
        </div>
    </div>
</template>

<style scoped>
.ban-message {
  background-color: #fce8e8; /* Light red background */
  border: 1px solid #ecc7c7; /* Slightly darker red border */
  color: #c00; /* Dark red text */
}
</style>