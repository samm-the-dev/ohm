/** Test stub for .toolbox/lib/google-drive-sync */
const noop = () => {};
const noopAsync = async () => {};

export function createDriveSync<T>(_opts: Record<string, unknown>) {
  return {
    isAuthenticated: () => false,
    getAuthLevel: () => 0,
    initDriveAuth: noopAsync,
    silentRefresh: noopAsync,
    signOut: noop,
    loadFromDrive: noopAsync as () => Promise<T | null>,
    saveToDrive: noopAsync,
  };
}
