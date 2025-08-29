# Notion Integrations

The Notion Integrations project is a dynamic, project aimed to provide integrations around notion platform.

## Technologies

Notion Integrations is built using the following technologies:

- [Tailwind CSS](https://tailwindcss.com/): A utility-first CSS framework for rapidly building custom user interfaces.
- [TypeScript](https://www.typescriptlang.org/): A statically typed superset of JavaScript that adds optional types, classes, and interfaces to the language.
- [Nuxt.js 4](https://v4.nuxtjs.org/): A framework for creating Vue.js applications. It simplifies the development process and provides a solid foundation for building complex applications.
- [Drizzle.js](https://drizzlejs.com/): An ORM (Object-Relational Mapping) library for JavaScript. It provides a simple and intuitive way to interact with SQL databases.
- [PostgreSQL](https://www.postgresql.org/): A powerful, open source relational database system.
- [Vue Shadcn Components](https://shadcn.com/docs/ui/): A set of Vue.js components built on top of Tailwind CSS that provide a consistent and visually appealing UI.
- [BetterAuth](https://github.com/leamsigc/better-auth): using BetterAuth for authentication and authorization.
- [Notion SDK](https://github.com/leamsigc/better-auth): using Notion SDK for interacting with Notion API.
- [Vue query](https://tanstack.com/query/v5): using Vue query for data fetching and caching.

## Repository pattern

- Repository pattern to wrap the api fetch logic, the repo should be an object that contains multiple methods, each method should be responsible for a specific action.

## Pages code

- We should use vue query to fetch data in pages, the vue query composables should be used with the corresponding repo for the page

## UI Components

- UiButton
- UiInput
