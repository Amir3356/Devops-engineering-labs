import { useMemo } from 'react';
import { AbilityProvider as CaslAbilityProvider, Can, useAbility as useCaslAbility } from '@casl/react';
import { useAuth } from './AuthContext';
import { defineAbilityFor } from './ability';

export { Can };

export function AbilityProvider({ children }) {
  const { user } = useAuth();
  const ability = useMemo(() => defineAbilityFor(user), [user]);

  return (
    <CaslAbilityProvider value={ability}>
      {children}
    </CaslAbilityProvider>
  );
}

export function useAbility() {
  const { user } = useAuth();
  try {
    return useCaslAbility();
  } catch {
    return defineAbilityFor(user);
  }
}
