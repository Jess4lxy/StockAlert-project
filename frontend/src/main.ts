import { createApp } from 'vue';
import App from './App.vue';
import { iniciarPwa } from './pwa/usePwa';
// Inter incluida en la app (no desde Google Fonts) para que se vea igual sin conexión
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './style.css';

createApp(App).mount('#app');
iniciarPwa();
