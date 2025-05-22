<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  imageUrl: string | null;
}>();

const emit = defineEmits(['close']);

const isOpen = ref(false);

watch(() => props.imageUrl, (newVal) => {
  isOpen.value = !!newVal; // Open if imageUrl is not null, close otherwise
});

const closeDialog = () => {
  isOpen.value = false;
  emit('close'); // Emit close event to parent
};

// Close on escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeDialog();
  }
};

// Register/unregister keydown listener
import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

</script>

<template>
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="preview-bg fixed inset-0 flex items-center justify-center z-[1000] p-4"
      @click.self="closeDialog"
    >
      <div class="relative max-w-full max-h-full overflow-auto">
        <button
          @click="closeDialog"
          class="absolute top-4 right-4 text-white text-3xl font-bold cursor-pointer z-10"
        >
          &times;
        </button>
        <img :src="imageUrl || ''" alt="Enlarged Image" class="max-w-full max-h-full object-contain" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.preview-bg{
    background: rgba(79, 66, 66, 0.2);
    border-radius: 16px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(79, 66, 66, 0.3);
}

</style>