import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Email + password only, no `verify` provider configured on Password below,
// which means Convex Auth does not require email verification: an account
// is usable immediately after sign-up.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
