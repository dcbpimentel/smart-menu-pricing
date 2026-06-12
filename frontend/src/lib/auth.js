export const getToken = () => localStorage.getItem('smp_token');

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('smp_user') || 'null');
  } catch {
    return null;
  }
};

export const isLoggedIn = () => !!getToken();

export const logout = () => {
  localStorage.removeItem('smp_token');
  localStorage.removeItem('smp_user');
  window.location.replace('/login');
};
