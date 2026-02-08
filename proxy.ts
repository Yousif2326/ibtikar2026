import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

// Redirect URI must match your callback route and WorkOS Dashboard redirects.
const redirectUri =
  process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? 'http://localhost:3000/callback';

export default authkitMiddleware({
  redirectUri,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/'],
  },
});

export const config = { matcher: ['/', '/account/:page*', '/callback'] };
