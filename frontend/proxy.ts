import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

const redirectUri =
  process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? 'http://localhost:3000/callback';

export default authkitMiddleware({
  redirectUri,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/'],
  },
});

export const config = {
  matcher: ['/', '/dashboard/:path*', '/account/:path*', '/callback','/api/:path*'],
};
