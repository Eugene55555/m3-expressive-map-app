/* Fonts: Roboto (M3 typeface) and Material Symbols Rounded (icons, subset). */
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './styles/icons.css';

/* Material Web components used by the app (standard components only). */
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/fab/fab.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/filled-text-field.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/ripple/ripple.js';
import '@material/web/switch/switch.js';
import '@material/web/dialog/dialog.js';
import '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/divider/divider.js';

/* Application styles and custom layout components. */
import './styles/tokens.css';
import './styles/app.css';
import './ui/map.ts';
import './ui/search-bar.ts';
import './ui/screens/home.ts';
import './ui/screens/search.ts';
import './ui/screens/saved.ts';
import './ui/screens/settings.ts';
import './ui/app.ts';

function bootstrap(): void {
  if (!window.location.hash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/home`);
  }
  const container = document.getElementById('app');
  if (!container) return;
  const app = document.createElement('m3-app');
  container.append(app);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
