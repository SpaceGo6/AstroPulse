// Prototype bone-health snapshot shipped with the app. The live backend is not required.
import demo from './boneHealthDemo.json';

export function useBoneHealth() {
  return { status: 'ready', data: demo, error: null, astronautId: null, retry() {} };
}
