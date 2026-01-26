import { requestExpandedMode } from '@devvit/web/client';
import { setEntryAction } from './lib/entryAction';
import splashBackgroundWeb from './assets/images/background_1_splash_web.png';
import splashBackgroundMobile from './assets/images/background_1_splash_mobile.png';
import knockButton from './assets/images/knock button.gif';
import profileIcon from './assets/images/profile_icon.png';
import './styles/main.css';

const root = document.getElementById('splash-root');
if (!root) {
  throw new Error('Splash root not found');
}

const app = document.createElement('div');
app.className = 'app app--splash app--home';

const resolveSplashBackground = (): string => {
  if (typeof window === 'undefined') {
    return splashBackgroundWeb;
  }
  return window.innerHeight >= window.innerWidth ? splashBackgroundMobile : splashBackgroundWeb;
};

const applySplashBackground = () => {
  app.style.backgroundImage = `url(${resolveSplashBackground()})`;
};

applySplashBackground();
window.addEventListener('resize', applySplashBackground);

const content = document.createElement('div');
content.className = 'app__content';

const main = document.createElement('main');
main.className = 'screen screen--home';

const cornerActions = document.createElement('div');
cornerActions.className = 'corner-actions';

const profileButton = document.createElement('button');
profileButton.className = 'icon-button';
profileButton.type = 'button';
profileButton.setAttribute('aria-label', 'Your profile');

const profileImage = new Image();
profileImage.src = profileIcon;
profileImage.alt = '';
profileButton.appendChild(profileImage);

const homeCenter = document.createElement('div');
homeCenter.className = 'home-center';

const knockButtonEl = document.createElement('button');
knockButtonEl.className = 'image-button image-button--knock';
knockButtonEl.type = 'button';
knockButtonEl.setAttribute('aria-label', 'Knock the door');

const knockImage = new Image();
knockImage.src = knockButton;
knockImage.alt = 'Knock The Door';
knockButtonEl.appendChild(knockImage);

const requestGameEntry = async (event: MouseEvent, action: 'start' | 'achievements') => {
  setEntryAction(action);
  try {
    await requestExpandedMode(event, 'game');
  } catch (err) {
    console.error('Failed to open the game view', err);
  }
};

profileButton.addEventListener('click', (event) => {
  void requestGameEntry(event, 'achievements');
});

knockButtonEl.addEventListener('click', (event) => {
  void requestGameEntry(event, 'start');
});

cornerActions.appendChild(profileButton);
homeCenter.appendChild(knockButtonEl);
main.appendChild(cornerActions);
main.appendChild(homeCenter);
content.appendChild(main);
app.appendChild(content);
root.appendChild(app);
