// Decide si la web corre contra Firebase o en modo demo (sin backend).
import rawConfig from '../firebase/firebase.config.json'
import type { FirebaseWebConfig } from './firestoreAdapter'

const cfg = rawConfig as unknown as FirebaseWebConfig & { _ayuda?: string }

export const firebaseConfig: FirebaseWebConfig | null =
  cfg.apiKey && !cfg.apiKey.startsWith('PEGAR') && cfg.projectId && !cfg.projectId.startsWith('PEGAR')
    ? { apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId, storageBucket: cfg.storageBucket, messagingSenderId: cfg.messagingSenderId }
    : null

export const IS_DEMO = firebaseConfig === null
