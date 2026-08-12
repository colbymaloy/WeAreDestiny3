/**
 * Firebase web config.
 *
 * Not secret — a web API key identifies the project, it authorises nothing.
 * Access is controlled by Auth, the Storage and Firestore rules, and the
 * functions' own token checks. Meant to be committed.
 *
 * Regenerate with:  firebase apps:sdkconfig WEB --project wearedestiny3
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyBJota9LfEFPzaYLlQtWNtxW96byNMbXaI',
  authDomain: 'wearedestiny3.firebaseapp.com',
  projectId: 'wearedestiny3',
  storageBucket: 'wearedestiny3.firebasestorage.app',
  appId: '1:949595489888:web:88084526c527946d326505',
};

/* Hosting rewrites /api/* onto the functions, so there is no endpoint URL to
   keep in sync here. */
export const isConfigured = () => Boolean(firebaseConfig.apiKey);
