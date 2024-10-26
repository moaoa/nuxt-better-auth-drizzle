

export default defineNuxtRouteMiddleware(async (to) => { 

// Check if the user is navigating to the app route
    const isUserNavigatingToTheApp = to.path.startsWith('/app');
    const { loggedIn } = useUserSession();

    if (isUserNavigatingToTheApp && !loggedIn.value) {
        return navigateTo('/login');
    }

});