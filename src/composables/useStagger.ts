import { nextTick } from 'vue';

export function useStagger () {
    const staggerEnter = (el: Element, done: () => void) => {
        // 'el' is the div containing the buttons
        const buttons = el.querySelectorAll('button'); // Get all button children
        const delay = 200; // ms per button
    
        // Set initial state (same as enter-from)
        (el as HTMLElement).style.opacity = '0';
        (el as HTMLElement).style.transform = 'scale(0.8)';
        (el as HTMLElement).style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    
        // Force reflow to ensure transition starts from initial state
        document.body.offsetHeight;
    
        // Animate the container first
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'scale(1)';
    
        buttons.forEach((button: HTMLElement) => {
            button.style.opacity = '0';
            button.style.transform = 'scale(0.8)';
            button.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        });
    
        // Wait a tiny bit or use nextTick, then apply final state with staggered delay
        nextTick(() => {
            buttons.forEach((button: HTMLElement, index: number) => {
            setTimeout(() => {
                button.style.opacity = '1';
                button.style.transform = 'scale(1)';
            }, index * delay);
            });
    
            // Call done when the *longest* individual button animation should be finished
            // Or, if only animating opacity/scale on container, call done after container transition duration
            const totalDuration = 300; // 0.3s from CSS
            const totalDelay = (buttons.length - 1) * delay;
            setTimeout(done, totalDuration + totalDelay); // Wait for the last button to finish
    
        });
    };
    
    const staggerLeave = (el: Element, done: () => void) => {
        const buttons = el.querySelectorAll('button');
        const delay = 50; // ms per button
        const duration = 300; // ms for animation
        const totalButtons = buttons.length;
    
        // Set the transition property for all buttons
        buttons.forEach((button: HTMLElement) => {
            button.style.transition = `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`;
        });
    
        // Apply final state with reversed stagger delay
        buttons.forEach((button: HTMLElement, index: number) => {
            const leaveDelay = (totalButtons - 1 - index) * delay; // Reverse delay
            setTimeout(() => {
            // Apply final state to trigger transition
            button.style.opacity = '0';
            button.style.transform = 'scale(0.8)';
            }, leaveDelay);
        });
    
        // Call done after the last animation is expected to finish
        const totalDelay = (totalButtons - 1) * delay;
        setTimeout(done, totalDelay + duration);
    };

    return {
        staggerEnter,
        staggerLeave
    }
}
