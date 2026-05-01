import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectAuthUser } from '../slice/authSlice/selectors';

export const useCompanyTheme = () => {
  const user = useSelector(selectAuthUser) as any;
  const company = user?.company;

  useEffect(() => {
    const primary = company?.primary_color || '#e55400';
    const secondary = company?.secondary_color || '#ffda00';

    const root = document.documentElement;
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-secondary', secondary);

    // The CSS color-mix in index.css will handle the light/dark variants 
    // based on these updated variables.
  }, [company]);
};
