// Ressources 3D externes (modèle humain riggé et animé), chargées une fois au démarrage.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const assets = { soldier: null };

export async function loadAssets(onProgress = () => {}) {
  const loader = new GLTFLoader();
  assets.soldier = await loader.loadAsync('assets/soldier.glb', (e) => {
    if (e.lengthComputable) onProgress(e.loaded / e.total);
  });
  return assets;
}
