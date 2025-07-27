import { authClient } from "~~/lib/auth-client";

export default defineNuxtRouteMiddleware(async (to) => {
  // Check if the user is navigating to the app route
  const isUserNavigatingToTheApp = to.path.startsWith("/app");
  const { data: loggedIn } = await authClient.useSession(useFetch);
  const isNavigatingToLoginOrRegister =
    to.path.startsWith("/login") || to.path.startsWith("/register");

  const isNavigatingToDashboard = to.path.startsWith("/dashboard");

  if (isUserNavigatingToTheApp && !loggedIn.value) {
    return navigateTo("/login");
  }

  if (isNavigatingToDashboard && !loggedIn.value) {
    return navigateTo("/login");
  }

  if (isNavigatingToLoginOrRegister && loggedIn.value) {
    return navigateTo("/app");
  }
});
